// ============================================================================
// VaultSync — Content Script: Autofill & Auto-Save Engine
// Detects login forms, fills credentials, and captures new/updated passwords.
// No external imports — all crypto is handled by the service worker.
// ============================================================================

interface DetectedField {
  element: HTMLInputElement;
  fieldType: 'username' | 'email' | 'password' | 'unknown';
  confidence: number;
}

interface CapturedCredentials {
  username: string;
  password: string;
  domain: string;
  url: string;
  title: string;
}

// ---- State ----

let autofillBubble: HTMLDivElement | null = null;
let saveToast: HTMLDivElement | null = null;
let styleInjected = false;
let lastCapturedPassword = '';
let lastCapturedUsername = '';
let activeField: DetectedField | null = null;

// Track username/email values across multi-step login forms
let trackedUsername = '';
let trackedUsernameTimestamp = 0;

// ---- CSS Injection ----

function injectStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes vaultsync-fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes vaultsync-slideDown {
      from { opacity: 0; transform: translateY(-100%); }
      to { opacity: 1; transform: translateY(0); }
    }
    .vaultsync-bubble:hover {
      border-color: rgba(92, 224, 214, 0.4) !important;
      box-shadow: 0 8px 40px rgba(92,224,214,0.15) !important;
    }
    .vaultsync-toast-btn:hover {
      filter: brightness(1.15);
    }
    .vaultsync-bubble-close:hover {
      color: #f1f5f9 !important;
      background: rgba(255, 255, 255, 0.1) !important;
    }
  `;
  document.head.appendChild(style);
}

// ============================================================================
// Field Detection — Robust classifier for login/signup forms
// ============================================================================

function detectLoginFields(): DetectedField[] {
  const fields: DetectedField[] = [];
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="image"]):not([type="range"]):not([type="color"]):not([type="date"]):not([type="time"])'
  ));

  console.log(`[VaultSync Autofill] detectLoginFields found ${inputs.length} candidate input fields.`);

  const classifiedInputs: { element: HTMLInputElement; field: DetectedField }[] = [];

  for (const input of inputs) {
    // If it has a value, never skip it
    if (!input.value) {
      const rect = input.getBoundingClientRect();
      const style = window.getComputedStyle(input);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
      // Allow very small/invisible dimensions in case of custom layout overlays
      if (rect.width < 5 || rect.height < 5) continue;
    }

    const field = classifyField(input);
    classifiedInputs.push({ element: input, field });
  }

  // Look-ahead pairing: If a text/email/tel field precedes a password field, it is extremely likely to be the username
  for (let i = 0; i < classifiedInputs.length; i++) {
    const current = classifiedInputs[i];
    if (current.field.fieldType === 'unknown') {
      const type = current.element.type.toLowerCase();
      if (type === 'text' || type === 'email' || type === 'tel' || type === '') {
        // Look ahead up to 2 fields for a password field
        for (let j = i + 1; j < Math.min(classifiedInputs.length, i + 3); j++) {
          if (classifiedInputs[j].field.fieldType === 'password') {
            current.field.fieldType = 'username';
            current.field.confidence = 0.85;
            break;
          }
        }
      }
    }
  }

  // Collect all valid classified fields
  for (const item of classifiedInputs) {
    if (item.field.fieldType !== 'unknown') {
      fields.push(item.field);
    }
  }

  console.log('[VaultSync Autofill] Classified fields:', fields.map(f => ({ name: f.element.name, id: f.element.id, type: f.fieldType, confidence: f.confidence })));
  return fields;
}

function classifyField(input: HTMLInputElement): DetectedField {
  const type = input.type.toLowerCase();
  const name = (input.name || '').toLowerCase();
  const id = (input.id || '').toLowerCase();
  const placeholder = (input.placeholder || '').toLowerCase();
  const autocomplete = (input.autocomplete || '').toLowerCase();
  const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
  const dataTestId = (input.getAttribute('data-testid') || '').toLowerCase();
  const className = (input.className || '').toLowerCase();

  const identifiers = `${type} ${name} ${id} ${placeholder} ${autocomplete} ${ariaLabel} ${dataTestId} ${className}`;

  // Password detection (highest priority)
  if (type === 'password') {
    return { element: input, fieldType: 'password', confidence: 1.0 };
  }
  if (autocomplete === 'current-password' || autocomplete === 'new-password') {
    return { element: input, fieldType: 'password', confidence: 1.0 };
  }
  if (/password|passwd|pwd|pass[-_]?w/.test(identifiers)) {
    return { element: input, fieldType: 'password', confidence: 0.8 };
  }

  // Email detection
  if (type === 'email' || autocomplete === 'email' || autocomplete === 'username email') {
    return { element: input, fieldType: 'email', confidence: 1.0 };
  }
  if (/email|e-mail|correo/.test(identifiers)) {
    return { element: input, fieldType: 'email', confidence: 0.85 };
  }

  // Username detection
  if (autocomplete === 'username') {
    return { element: input, fieldType: 'username', confidence: 1.0 };
  }
  if (/username|user[-_]?name|login[-_]?id|user[-_]?id|account[-_]?name|handle|screen[-_]?name|nick/.test(identifiers)) {
    return { element: input, fieldType: 'username', confidence: 0.9 };
  }

  // Check associated label
  const label = findAssociatedLabel(input);
  if (label) {
    const labelText = label.toLowerCase();
    if (/password|contraseña|mot de passe|passwort/.test(labelText)) return { element: input, fieldType: 'password', confidence: 0.75 };
    if (/email|e-mail|correo/.test(labelText)) return { element: input, fieldType: 'email', confidence: 0.8 };
    if (/user|login|account|sign.?in|log.?in|identifier/.test(labelText)) return { element: input, fieldType: 'username', confidence: 0.7 };
    if (/phone|mobile|número/.test(labelText)) return { element: input, fieldType: 'username', confidence: 0.5 };
  }

  // Check if it's a text input near a password field (likely a username)
  if (type === 'text' || type === 'tel' || type === '') {
    const form = input.closest('form');
    if (form) {
      const passwordFields = form.querySelectorAll('input[type="password"]');
      if (passwordFields.length > 0) {
        // Check if this input comes BEFORE the password field
        const allInputs = Array.from(form.querySelectorAll('input'));
        const myIdx = allInputs.indexOf(input);
        const pwIdx = allInputs.indexOf(passwordFields[0] as HTMLInputElement);
        if (myIdx < pwIdx && myIdx >= 0) {
          return { element: input, fieldType: 'username', confidence: 0.6 };
        }
      }
    }
    // Also check without a form container (some SPAs don't use <form>)
    const parent = input.closest('div[class*="login"], div[class*="signin"], div[class*="auth"], section, main, [role="main"]');
    if (parent) {
      const passwordFields = parent.querySelectorAll('input[type="password"]');
      if (passwordFields.length > 0) {
        return { element: input, fieldType: 'username', confidence: 0.5 };
      }
    }
  }

  return { element: input, fieldType: 'unknown', confidence: 0 };
}

function findAssociatedLabel(input: HTMLInputElement): string | null {
  // Explicit label via 'for' attribute
  if (input.id) {
    const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    if (label) return label.textContent;
  }
  // Wrapping label
  const parent = input.closest('label');
  if (parent) return parent.textContent;
  // aria-labelledby
  const labelledBy = input.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl) return labelEl.textContent;
  }
  // aria-label
  if (input.getAttribute('aria-label')) return input.getAttribute('aria-label');
  // Adjacent sibling or parent text
  const prevSibling = input.previousElementSibling;
  if (prevSibling && prevSibling.tagName === 'LABEL') return prevSibling.textContent;
  return null;
}

// ============================================================================
// Autofill Bubble — Shown on field focus when credentials exist
// ============================================================================

function showAutofillBubble(field: DetectedField, itemCount: number) {
  console.log(`[VaultSync Autofill] Showing bubble near element:`, field.element, `Item count: ${itemCount}`);
  removeAutofillBubble();
  injectStyles();

  const bubble = document.createElement('div');
  bubble.id = 'vaultsync-autofill-bubble';
  bubble.className = 'vaultsync-bubble';
  bubble.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    border: 1px solid rgba(92, 224, 214, 0.2);
    border-radius: 12px;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    color: #e2e8f0;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
    animation: vaultsync-fadeIn 0.2s ease;
    user-select: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  `;

  positionBubbleNearField(bubble, field.element);

  bubble.innerHTML = `
    <div style="width: 24px; height: 24px; border-radius: 7px; background: linear-gradient(135deg, #5ce0d6, #a78bfa); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
    </div>
    <div style="flex: 1; min-width: 0;">
      <div style="font-weight: 600; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${itemCount} saved credential${itemCount !== 1 ? 's' : ''}</div>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 1px;">Click to autofill</div>
    </div>
    <div style="background: rgba(92,224,214,0.15); color: #5ce0d6; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 6px; flex-shrink: 0; margin-right: 2px;">Fill</div>
    <button class="vaultsync-bubble-close" style="background: none; border: none; color: #64748b; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 6px; transition: color 0.15s, background 0.15s;" title="Dismiss">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
  `;

  bubble.addEventListener('click', (e) => {
    e.stopPropagation();
    fillCredentials(field);
    removeAutofillBubble();
  });

  bubble.querySelector('.vaultsync-bubble-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    removeAutofillBubble();
  });

  document.body.appendChild(bubble);
  autofillBubble = bubble;

  // Reposition on scroll
  const scrollHandler = () => positionBubbleNearField(bubble, field.element);
  window.addEventListener('scroll', scrollHandler, { passive: true });
  (bubble as any)._scrollHandler = scrollHandler;

  // Auto-dismiss after 12 seconds
  setTimeout(removeAutofillBubble, 12000);
}

function positionBubbleNearField(bubble: HTMLElement, field: HTMLInputElement) {
  const rect = field.getBoundingClientRect();
  const bubbleHeight = 52;
  const gap = 6;

  // Try below the field first, then above
  let top = rect.bottom + gap;
  if (top + bubbleHeight > window.innerHeight) {
    top = rect.top - bubbleHeight - gap;
  }

  bubble.style.left = `${Math.max(8, rect.left)}px`;
  bubble.style.top = `${Math.max(8, top)}px`;
  bubble.style.width = `${Math.min(rect.width, 340)}px`;
}

function removeAutofillBubble() {
  if (autofillBubble) {
    if ((autofillBubble as any)._scrollHandler) {
      window.removeEventListener('scroll', (autofillBubble as any)._scrollHandler);
    }
    autofillBubble.remove();
    autofillBubble = null;
  }
}

// ============================================================================
// Save / Update Toast — Shown after form submission
// ============================================================================

function showSaveToast(credentials: CapturedCredentials, isUpdate: boolean) {
  removeSaveToast();
  injectStyles();

  const toast = document.createElement('div');
  toast.id = 'vaultsync-save-toast';
  toast.style.cssText = `
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 2147483647;
    width: 380px;
    max-width: calc(100vw - 32px);
    background: linear-gradient(135deg, #0f172a, #1e293b);
    border: 1px solid rgba(92, 224, 214, 0.2);
    border-radius: 14px;
    padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e2e8f0;
    box-shadow: 0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
    animation: vaultsync-slideDown 0.3s ease;
  `;

  const maskedPassword = '•'.repeat(Math.min(credentials.password.length, 16));

  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
      <div style="width: 32px; height: 32px; border-radius: 9px; background: linear-gradient(135deg, #5ce0d6, #a78bfa); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
      </div>
      <div style="flex: 1;">
        <div style="font-weight: 700; font-size: 14px;">${isUpdate ? 'Update password?' : 'Save password?'}</div>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">${credentials.domain}</div>
      </div>
      <button id="vaultsync-toast-close" style="background: none; border: none; color: #64748b; cursor: pointer; padding: 4px; display: flex;" title="Dismiss">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px 12px; margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Username</span>
      </div>
      <div style="font-size: 13px; color: #f1f5f9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(credentials.username)}</div>
      <div style="height: 1px; background: rgba(255,255,255,0.06); margin: 8px 0;"></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Password</span>
      </div>
      <div style="font-size: 13px; color: #f1f5f9; font-family: monospace; letter-spacing: 0.1em;">${maskedPassword}</div>
    </div>
    <div style="display: flex; gap: 8px;">
      <button id="vaultsync-toast-save" class="vaultsync-toast-btn" style="flex: 1; height: 36px; border: none; border-radius: 8px; background: linear-gradient(135deg, #5ce0d6, #a78bfa); color: #0f172a; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; transition: filter 0.15s;">
        ${isUpdate ? 'Update' : 'Save'}
      </button>
      <button id="vaultsync-toast-dismiss" class="vaultsync-toast-btn" style="flex: 1; height: 36px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; background: rgba(255,255,255,0.05); color: #94a3b8; font-weight: 600; font-size: 13px; cursor: pointer; font-family: inherit; transition: filter 0.15s;">
        Not now
      </button>
    </div>
  `;

  document.body.appendChild(toast);
  saveToast = toast;

  // Wire up buttons
  toast.querySelector('#vaultsync-toast-save')?.addEventListener('click', async () => {
    const saveBtn = toast.querySelector('#vaultsync-toast-save') as HTMLButtonElement;
    if (saveBtn) {
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;
    }
    try {
      if (isUpdate) {
        await chrome.runtime.sendMessage({
          type: 'UPDATE_CREDENTIALS',
          payload: credentials,
        });
      } else {
        await chrome.runtime.sendMessage({
          type: 'SAVE_CREDENTIALS',
          payload: credentials,
        });
      }
      // Show success briefly
      toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0;">
          <div style="width: 28px; height: 28px; border-radius: 50%; background: rgba(34,197,94,0.15); display: flex; align-items: center; justify-content: center;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <span style="font-weight: 600; font-size: 14px; color: #22c55e;">${isUpdate ? 'Password updated!' : 'Password saved!'}</span>
        </div>
      `;
      setTimeout(removeSaveToast, 2000);
    } catch (e) {
      console.error('[VaultSync] Save failed:', e);
      if (saveBtn) {
        saveBtn.textContent = 'Failed — retry';
        saveBtn.disabled = false;
      }
    }
  });

  toast.querySelector('#vaultsync-toast-dismiss')?.addEventListener('click', removeSaveToast);
  toast.querySelector('#vaultsync-toast-close')?.addEventListener('click', removeSaveToast);

  // Auto-dismiss after 30 seconds
  setTimeout(removeSaveToast, 30000);
}

function removeSaveToast() {
  if (saveToast) {
    saveToast.remove();
    saveToast = null;
    // Notify background script to clear pending credentials
    chrome.runtime.sendMessage({ type: 'CLEAR_PENDING_CREDENTIALS' }).catch(() => {});
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================================
// Autofill — Fill detected fields with saved credentials
// ============================================================================

async function fillCredentials(_field?: DetectedField) {
  console.log('[VaultSync Autofill] Triggering credential autofill...');
  const domain = window.location.hostname.replace('www.', '');
  console.log(`[VaultSync Autofill] Requesting decrypted credentials for domain: ${domain}`);

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'AUTOFILL_CREDENTIALS_FOR_DOMAIN',
      payload: { domain },
    });

    console.log('[VaultSync Autofill] Received autofill response:', response);

    if (response?.locked) {
      console.log('[VaultSync Autofill] Vault is locked. Requesting side panel open.');
      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
      return;
    }

    if (!response?.success) {
      console.log('[VaultSync Autofill] No credentials found for this domain.');
      return;
    }

    // Find and fill all fields
    const fields = detectLoginFields();
    for (const f of fields) {
      if (f.fieldType === 'username' || f.fieldType === 'email') {
        setInputValue(f.element, response.username);
      } else if (f.fieldType === 'password') {
        setInputValue(f.element, response.password);
      }
    }
  } catch (e) {
    console.error('[VaultSync] Autofill failed:', e);
  }
}

function setInputValue(input: HTMLInputElement, value: string) {
  // Focus the input first
  input.focus();

  // Use native setter to trigger React/Angular/Vue change detection
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
  } else {
    input.value = value;
  }

  // Dispatch the full event chain for maximum framework compatibility
  input.dispatchEvent(new Event('focus', { bubbles: true }));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
  input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
}

// ============================================================================
// Form Submission Interception — Capture credentials on login
// ============================================================================

function interceptFormSubmissions() {
  console.log('[VaultSync Autofill] Setting up form submission interception...');

  // Listen for native form submissions
  document.addEventListener('submit', (e) => {
    console.log('[VaultSync Autofill] Form submit event detected');
    handleFormSubmit(e);
  }, true);

  // Track username/email values as user types (for multi-step login forms)
  document.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    if (!target || target.tagName !== 'INPUT') return;
    const field = classifyField(target);
    if ((field.fieldType === 'username' || field.fieldType === 'email') && target.value) {
      trackedUsername = target.value;
      trackedUsernameTimestamp = Date.now();
      console.log('[VaultSync Autofill] Tracked username:', trackedUsername);
    }
  }, true);

  // Intercept click on buttons that might submit forms (SPAs)
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const button = target.closest('button, [role="button"], input[type="submit"], a[href="#"], a[role="button"]') as HTMLElement;
    if (!button) return;

    console.log('[VaultSync Autofill] Button clicked, checking for credential capture...');
    tryCapturingFromButton(button);
  }, true);

  // Intercept Enter key on any input fields (common login submission)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLInputElement;
    if (!target || target.tagName !== 'INPUT') return;

    console.log('[VaultSync Autofill] Enter key pressed, checking for credential capture...');

    const container = target.closest('form') || findCredentialContainer(target);
    if (container) {
      const passwordEl = container.querySelector('input[type="password"]') as HTMLInputElement;
      if (passwordEl && passwordEl.value) {
        console.log('[VaultSync Autofill] Password field has value, capturing credentials...');
        setTimeout(() => {
          const fields = detectFieldsInContainer(container as HTMLElement);
          captureCredentialsFromFields(fields);
        }, 100);
      }
    } else {
      // Fallback: check if page has a password field with a value
      const allFields = detectLoginFields();
      const hasPasswordVal = allFields.some(f => f.fieldType === 'password' && f.element.value);
      if (hasPasswordVal) {
        console.log('[VaultSync Autofill] Password field found on page, capturing credentials...');
        setTimeout(() => {
          captureCredentialsFromFields(allFields);
        }, 100);
      }
    }
  }, true);
}

function tryCapturingFromButton(button: HTMLElement) {
  const buttonText = (button.textContent || '').toLowerCase().trim();
  const buttonType = (button as HTMLButtonElement).type?.toLowerCase();
  const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
  const testId = (button.getAttribute('data-testid') || '').toLowerCase();

  console.log('[VaultSync Autofill] Button analysis:', { buttonText, buttonType, ariaLabel, testId });

  // Exclude eye icons / forgot password / cancel button clicks
  const ignorePatterns = /show|hide|reveal|forgot|cancel|close|reset|toggle/i;
  if (ignorePatterns.test(buttonText) || ignorePatterns.test(ariaLabel) || ignorePatterns.test(testId)) {
    console.log('[VaultSync Autofill] Button ignored (matches ignore pattern)');
    return;
  }

  // Find the nearest form or credential container
  const form = button.closest('form');
  const container = form || findCredentialContainer(button);
  
  let hasPasswordWithValue = false;
  if (container) {
    const pw = container.querySelector('input[type="password"]') as HTMLInputElement;
    if (pw && pw.value) hasPasswordWithValue = true;
  } else {
    const pws = Array.from(document.querySelectorAll('input[type="password"]')) as HTMLInputElement[];
    if (pws.some(p => p.value)) hasPasswordWithValue = true;
  }

  console.log('[VaultSync Autofill] Password field with value found:', hasPasswordWithValue);

  // Broad check: does the button text CONTAIN login-related words?
  const loginPatterns = /sign.?in|log.?in|submit|continue|next|enter|login|connexion|iniciar|anmelden|sign.?up|register|create.?account|get.?started|authenticate/i;
  const isLoginButton = loginPatterns.test(buttonText)
    || loginPatterns.test(ariaLabel)
    || loginPatterns.test(testId)
    || buttonType === 'submit'
    || hasPasswordWithValue; // Capture on any button click if a password field is filled

  console.log('[VaultSync Autofill] Is login button:', isLoginButton);

  if (!isLoginButton) return;

  if (container) {
    const fields = detectFieldsInContainer(container as HTMLElement);
    console.log('[VaultSync Autofill] Fields in container:', fields.map(f => ({ type: f.fieldType, hasValue: !!f.element.value })));
    if (fields.some(f => f.fieldType === 'password')) {
      console.log('[VaultSync Autofill] Capturing credentials from container...');
      captureCredentialsFromFields(fields);
      return;
    }
  }

  // Fallback: scan all visible fields on the page
  const allFields = detectLoginFields();
  console.log('[VaultSync Autofill] All fields on page:', allFields.map(f => ({ type: f.fieldType, hasValue: !!f.element.value })));
  if (allFields.some(f => f.fieldType === 'password')) {
    console.log('[VaultSync Autofill] Capturing credentials from page...');
    captureCredentialsFromFields(allFields);
  }
}

function findCredentialContainer(element: HTMLElement): HTMLElement | null {
  // Try progressively wider selectors
  return element.closest(
    'form, [class*="login"], [class*="signin"], [class*="sign-in"], [class*="auth"], '
    + '[class*="credential"], [class*="password"], [id*="login"], [id*="signin"], '
    + '[id*="auth"], [role="form"], [role="main"], section, main, '
    + '[class*="modal"], [class*="dialog"], [role="dialog"]'
  ) as HTMLElement | null;
}

function handleFormSubmit(e: Event) {
  const form = e.target as HTMLFormElement;
  if (!form || form.tagName !== 'FORM') return;

  const fields = detectFieldsInContainer(form);
  captureCredentialsFromFields(fields);
}

function detectFieldsInContainer(container: HTMLElement): DetectedField[] {
  const fields: DetectedField[] = [];
  const inputs = container.querySelectorAll<HTMLInputElement>('input');

  for (const input of inputs) {
    const field = classifyField(input);
    if (field.fieldType !== 'unknown') {
      fields.push(field);
    }
  }

  // Fallback: If the container scan did not find both username/email and password, look at the whole page
  const hasPassword = fields.some(f => f.fieldType === 'password');
  const hasUsername = fields.some(f => f.fieldType === 'username' || f.fieldType === 'email');
  if (!hasPassword || !hasUsername) {
    const pageFields = detectLoginFields();
    const hasPagePassword = pageFields.some(f => f.fieldType === 'password');
    const hasPageUsername = pageFields.some(f => f.fieldType === 'username' || f.fieldType === 'email');
    if (hasPagePassword && hasPageUsername) {
      return pageFields;
    }
  }

  return fields;
}

function captureCredentialsFromFields(fields: DetectedField[]) {
  console.log('[VaultSync Autofill] Attempting capture from fields:', fields.map(f => ({ id: f.element.id, type: f.fieldType, hasValue: !!f.element.value })));
  const passwordField = fields.find(f => f.fieldType === 'password');
  const usernameField = fields.find(f => f.fieldType === 'username' || f.fieldType === 'email');

  if (!passwordField || !passwordField.element.value) {
    console.log('[VaultSync Autofill] Capture aborted: no password field or no password value');
    return;
  }
  const password = passwordField.element.value;
  let username = usernameField?.element.value || '';

  // Multi-step login fallback: use tracked username if no username field is visible
  // but one was recently typed (within last 2 minutes)
  if (!username && trackedUsername && (Date.now() - trackedUsernameTimestamp) < 120000) {
    username = trackedUsername;
  }

  // Don't re-prompt for the same credentials
  if (password === lastCapturedPassword && username === lastCapturedUsername) {
    console.log('[VaultSync Autofill] Capture aborted: credentials already captured recently');
    return;
  }
  lastCapturedPassword = password;
  lastCapturedUsername = username;

  const domain = window.location.hostname.replace('www.', '');
  const credentials: CapturedCredentials = {
    username,
    password,
    domain,
    url: window.location.href,
    title: document.title || domain,
  };

  console.log('[VaultSync] Captured credentials:', { username, domain, url: credentials.url });

  // Stage credentials in background so they survive navigation/redirects
  chrome.runtime.sendMessage({
    type: 'STAGE_PENDING_CREDENTIALS',
    payload: credentials,
  }).then(() => {
    console.log('[VaultSync] Credentials staged successfully');
  }).catch((err: any) => {
    console.error('[VaultSync] Failed to stage credentials:', err);
  });

  // Also check if credentials already exist for this domain and try showing immediately
  chrome.runtime.sendMessage({
    type: 'CHECK_CREDENTIALS_EXIST',
    payload: { domain, username, password },
  }).then((response: { exists: boolean; passwordChanged: boolean }) => {
    console.log('[VaultSync] CHECK_CREDENTIALS_EXIST response:', response);
    if (response?.exists && response?.passwordChanged) {
      console.log('[VaultSync] Showing update toast');
      showSaveToast(credentials, true); // Update prompt
    } else if (!response?.exists) {
      console.log('[VaultSync] Showing save toast');
      showSaveToast(credentials, false); // Save prompt
    } else {
      console.log('[VaultSync] Credentials exist and password unchanged, not showing toast');
    }
  }).catch((err: any) => {
    console.error('[VaultSync] CHECK_CREDENTIALS_EXIST failed, showing save anyway:', err);
    showSaveToast(credentials, false);
  });
}

// ============================================================================
// Focus-Triggered Autofill — Show bubble when user clicks into fields
// ============================================================================

function setupFocusListeners() {
  document.addEventListener('focusin', async (e) => {
    const target = e.target as HTMLInputElement;
    if (!target || target.tagName !== 'INPUT') return;

    const field = classifyField(target);
    if (field.fieldType === 'unknown') return;

    // Only show for username/email/password fields
    if (field.fieldType === 'username' || field.fieldType === 'email' || field.fieldType === 'password') {
      activeField = field;

      // Check if we have credentials for this domain
      const domain = window.location.hostname.replace('www.', '');
      console.log(`[VaultSync Autofill] Field focused: ${field.fieldType}, checking credentials for domain: ${domain}`);
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_CREDENTIALS_FOR_DOMAIN',
          payload: { domain },
        });

        console.log(`[VaultSync Autofill] Credentials response:`, response);
        if (response?.items?.length > 0) {
          showAutofillBubble(field, response.items.length);
        } else {
          console.log(`[VaultSync Autofill] No credentials found for domain: ${domain}`);
        }
      } catch (err) {
        console.error('[VaultSync Autofill] Error checking credentials:', err);
        // Service worker might not be ready
      }
    }
  }, true);

  document.addEventListener('focusout', () => {
    // Delay removal so bubble click can register
    setTimeout(() => {
      if (autofillBubble && !autofillBubble.matches(':hover')) {
        removeAutofillBubble();
      }
    }, 200);
  }, true);
}

// ============================================================================
// Main Initialization
// ============================================================================

// Run on page load
function init() {
  console.log('[VaultSync] Content script loaded:', window.location.hostname);

  injectStyles();
  interceptFormSubmissions();
  setupFocusListeners();

  // Check if background has any staged pending credentials to show (e.g. from page redirection)
  checkPendingCredentials();

  // Initial scan for login forms (with delay for SPA rendering)
  setTimeout(scanForLoginForms, 800);
}

async function checkPendingCredentials() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_PENDING_CREDENTIALS' });
    if (response?.creds) {
      const creds = response.creds as CapturedCredentials;
      console.log('[VaultSync] Found staged pending credentials on page load:', creds.username);
      
      const check = await chrome.runtime.sendMessage({
        type: 'CHECK_CREDENTIALS_EXIST',
        payload: { domain: creds.domain, username: creds.username, password: creds.password }
      });

      console.log('[VaultSync] Staged credential exist check:', check);
      if (check?.exists && check?.passwordChanged) {
        showSaveToast(creds, true); // Update prompt
      } else if (!check?.exists) {
        showSaveToast(creds, false); // Save prompt
      }
    }
  } catch (e) {
    console.error('[VaultSync] Error checking pending credentials:', e);
  }
}

async function scanForLoginForms() {
  // Guard: if there is already an active autofill bubble, do not overwrite it
  if (autofillBubble) return;

  const fields = detectLoginFields();
  if (fields.length === 0) return;

  const domain = window.location.hostname.replace('www.', '');
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_CREDENTIALS_FOR_DOMAIN',
      payload: { domain },
    });

    if (response?.items?.length > 0) {
      // Show a subtle autofill bubble on the first username/email field
      const primaryField = fields.find(f => f.fieldType === 'username' || f.fieldType === 'email') || fields[0];
      showAutofillBubble(primaryField, response.items.length);
    }
  } catch {
    // Service worker not ready
  }
}

// Watch for dynamically loaded forms (SPAs)
let scanTimeout: number;
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    let hasRelevantAddedNodes = false;
    for (const node of Array.from(mutation.addedNodes)) {
      if (node instanceof HTMLElement) {
        // Skip if the node is our own bubble or toast, or contains them
        if (node.id === 'vaultsync-autofill-bubble' || 
            node.id === 'vaultsync-save-toast' || 
            node.querySelector('#vaultsync-autofill-bubble, #vaultsync-save-toast')) {
          continue;
        }
        hasRelevantAddedNodes = true;
        break;
      }
    }

    if (hasRelevantAddedNodes) {
      clearTimeout(scanTimeout);
      scanTimeout = window.setTimeout(scanForLoginForms, 600);
    }
  }
});

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message: { type: string; payload?: unknown }, _sender: unknown, sendResponse: (resp: unknown) => void) => {
  if (message.type === 'FILL_CREDENTIALS') {
    const fields = detectLoginFields();
    if (fields.length > 0) {
      fillCredentials(fields[0]);
    }
    sendResponse({ success: true });
  }
  return true;
});

// Keyboard shortcut (Ctrl+Shift+L) - Scan for login forms
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'L') {
    e.preventDefault();
    scanForLoginForms();
  }
});

// Keyboard shortcut (Ctrl+Shift+S) - Manual credential capture
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'S') {
    e.preventDefault();
    console.log('[VaultSync Autofill] Manual credential capture triggered (Ctrl+Shift+S)');
    const allFields = detectLoginFields();
    console.log('[VaultSync Autofill] Manual capture - detected fields:', allFields.map(f => ({ type: f.fieldType, hasValue: !!f.element.value })));
    if (allFields.some(f => f.fieldType === 'password' && f.element.value)) {
      captureCredentialsFromFields(allFields);
    } else {
      console.log('[VaultSync Autofill] Manual capture - no password field with value found');
    }
  }
});

// Clean up on navigation
window.addEventListener('beforeunload', () => {
  observer.disconnect();
  removeAutofillBubble();
  removeSaveToast();
});

// Start!
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Start observing after a short delay
setTimeout(() => {
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}, 1000);
