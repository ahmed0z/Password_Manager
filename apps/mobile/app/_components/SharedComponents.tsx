import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  Modal,
  Platform,
  TouchableWithoutFeedback,
  ScrollView,
  PanResponder,
  Animated,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';

// Local theme tokens (matching shared colors)
export const colors = {
  bgPrimary: '#5C6470',
  bgSecondary: '#4A515C',
  bgTertiary: '#3D434D',
  bgElevated: '#E9EAEC',
  bgGradientStart: '#707784',
  bgGradientEnd: '#4A515C',

  // Surfaces
  surfaceCard: '#3D434D',
  surfaceCardSelected: '#E9EAEC',
  surfaceBorder: 'rgba(255, 255, 255, 0.08)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#C7CBD1',
  textTertiary: '#9CA1AA',
  textInverse: '#1F2228',

  // Accents
  accentPrimary: '#F4E11A',
  accentSoft: 'rgba(244, 225, 26, 0.12)',
  success: '#C7E8B0',
  successText: '#1E4620',
  blackPill: '#171819',
  
  iconBtnBg: '#A8ACB5',
  iconColor: '#1F2228',
};

// 1. CircularIconButton
interface CircularIconButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
}
export function CircularIconButton({ children, onPress, style }: CircularIconButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.circularBtn, style]}
    >
      {children}
    </TouchableOpacity>
  );
}

// 2. Checkbox
interface CheckboxProps {
  checked: boolean;
  onPress?: () => void;
}
export function Checkbox({ checked, onPress }: CheckboxProps) {
  const content = (
    <View style={[styles.checkboxOutline, checked && styles.checkboxChecked]}>
      {checked && (
        <Svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <Path d="M1 4L3.5 6.5L9 1" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

// 3. PillTab (segmented control)
interface PillTabProps {
  tabs: string[];
  activeTab: string;
  onChange: (tab: string) => void;
}
export function PillTab({ tabs, activeTab, onChange }: PillTabProps) {
  return (
    <View style={styles.pillTabContainer}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab;
        return (
          <TouchableOpacity
            key={tab}
            activeOpacity={0.8}
            onPress={() => onChange(tab)}
            style={[styles.pillTabItem, isActive && styles.pillTabItemActive]}
          >
            <Text style={[styles.pillTabText, isActive && styles.pillTabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// 4. StatCapsule
interface StatCapsuleProps {
  label: string;
  value: string;
  state?: 'default' | 'active' | 'disabled' | 'outline';
  onPress?: () => void;
}
export function StatCapsule({ label, value, state = 'default', onPress }: StatCapsuleProps) {
  const isActive = state === 'active';
  const isOutline = state === 'outline';
  const isDisabled = state === 'disabled';

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      style={[
        styles.statCapsule,
        isActive && styles.statCapsuleActive,
        isOutline && styles.statCapsuleOutline,
        isDisabled && styles.statCapsuleDisabled,
      ]}
    >
      <Text style={[styles.statCapsuleValue, isActive && styles.statCapsuleValueActive]}>
        {value}
      </Text>
      <Text style={[styles.statCapsuleLabel, isActive && styles.statCapsuleLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// 5. StatusBadge
interface StatusBadgeProps {
  label: string;
  color?: string;
}
export function StatusBadge({ label, color = colors.success }: StatusBadgeProps) {
  const isWeak = label.toLowerCase() === 'weak';
  const isReused = label.toLowerCase() === 'reused' || label.toLowerCase() === 'medium';
  
  let dotBg = '#22C55E';
  let badgeBg = 'rgba(34, 197, 94, 0.12)';
  let textColor = '#22C55E';

  if (isWeak) {
    dotBg = '#EF4444';
    badgeBg = 'rgba(239, 68, 68, 0.12)';
    textColor = '#EF4444';
  } else if (isReused) {
    dotBg = '#F4E11A';
    badgeBg = 'rgba(244, 225, 26, 0.12)';
    textColor = '#F4E11A';
  }

  return (
    <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
      <View style={[styles.statusBadgeDot, { backgroundColor: dotBg }]} />
      <Text style={[styles.statusBadgeText, { color: textColor }]}>
        {label}
      </Text>
    </View>
  );
}

// 6. ListCard
interface ListCardProps {
  title: string;
  subtitle: string;
  favicon?: string;
  statusLabel?: string;
  metaColumns?: { label: string; value: string }[];
  checked?: boolean;
  onToggleCheck?: () => void;
  onPress?: () => void;
  selected?: boolean;
}
export function ListCard({
  title,
  subtitle,
  favicon,
  statusLabel,
  metaColumns,
  checked = false,
  onToggleCheck,
  onPress,
  selected = false,
}: ListCardProps) {
  const cardBg = selected ? colors.surfaceCardSelected : colors.surfaceCard;
  const textColor = selected ? colors.textInverse : colors.textPrimary;
  const subColor = selected ? '#6B7280' : colors.textSecondary;

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.75 : 1}
      onPress={onPress}
      style={[
        styles.listCard,
        { backgroundColor: cardBg },
        selected && styles.listCardSelected,
      ]}
    >
      <View style={styles.listCardHeader}>
        <View style={styles.avatarContainer}>
          {favicon ? (
            <Image source={{ uri: favicon }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarPlaceholder, selected && { backgroundColor: 'rgba(0,0,0,0.06)' }]}>
              <Text style={{ fontSize: 16 }}>🔑</Text>
            </View>
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: textColor }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.cardSub, { color: subColor }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>

        {statusLabel && (
          <StatusBadge label={statusLabel} />
        )}
      </View>

      {metaColumns && metaColumns.length > 0 && (
        <View style={styles.metaRow}>
          {metaColumns.map((col, idx) => (
            <View key={idx} style={styles.metaCol}>
              <Text style={[styles.metaLabel, selected && { color: '#6B7280' }]}>{col.label}</Text>
              <Text style={[styles.metaValue, { color: textColor }]} numberOfLines={1}>{col.value}</Text>
            </View>
          ))}
        </View>
      )}

      {onToggleCheck && (
        <View style={[styles.cardFooter, selected && { borderTopColor: 'rgba(0,0,0,0.06)' }]}>
          <Text style={[styles.footerText, selected && { color: '#6B7280' }]}>Synced</Text>
          <Checkbox checked={checked} onPress={onToggleCheck} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// 7. GaugeChart
interface GaugeChartProps {
  value: number; // 0 to 100
  subLabel?: string;
}
export function GaugeChart({ value, subLabel = 'Medium Risk' }: GaugeChartProps) {
  // SVG arc math
  const size = 180;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <View style={styles.gaugeContainer}>
      <Svg width={size} height={size / 2 + 10}>
        {/* Background Arc */}
        <Path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Filled Arc */}
        <Path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={colors.accentPrimary}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.gaugeCenterLabel}>
        <Text style={styles.gaugeValue}>{value}%</Text>
        <Text style={styles.gaugeSub}>{subLabel}</Text>
      </View>
    </View>
  );
}

// 8. MapPinBadge
interface MapPinBadgeProps {
  count?: number;
  variant?: 'standard' | 'high' | 'star';
  style?: any;
}
export function MapPinBadge({ count, variant = 'standard', style }: MapPinBadgeProps) {
  if (variant === 'star') {
    return (
      <View style={[styles.mapPinStar, style]}>
        <Text style={{ fontSize: 10 }}>⭐</Text>
      </View>
    );
  }

  const isHigh = variant === 'high';
  return (
    <View
      style={[
        styles.mapPin,
        isHigh && styles.mapPinHigh,
        style,
      ]}
    >
      <Text style={[styles.mapPinText, isHigh && styles.mapPinTextHigh]}>
        {count || 1}
      </Text>
    </View>
  );
}

interface FloatingPanelProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}
export function FloatingPanel({ visible, onClose, title, children }: FloatingPanelProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = Dimensions.get('window');
  const COLLAPSED_HEIGHT = screenHeight * 0.55;
  const EXPANDED_HEIGHT = screenHeight - 60;
  
  const COLLAPSED_TRANSLATION = screenHeight - COLLAPSED_HEIGHT;
  const EXPANDED_TRANSLATION = 60;
  const CLOSED_TRANSLATION = screenHeight;

  const animatedTranslateY = React.useRef(new Animated.Value(CLOSED_TRANSLATION)).current;
  const [isExpanded, setIsExpanded] = React.useState(false);
  const lastTranslation = React.useRef(COLLAPSED_TRANSLATION);
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);

  const animateTo = (targetTranslateY: number, expand: boolean, callback?: () => void) => {
    const isClosing = targetTranslateY === CLOSED_TRANSLATION;
    
    if (isClosing) {
      Animated.timing(animatedTranslateY, {
        toValue: targetTranslateY,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setIsExpanded(expand);
        lastTranslation.current = targetTranslateY;
        if (callback) callback();
      });
    } else {
      Animated.spring(animatedTranslateY, {
        toValue: targetTranslateY,
        useNativeDriver: true,
        friction: 8,
        tension: 50,
      }).start(() => {
        setIsExpanded(expand);
        lastTranslation.current = targetTranslateY;
        if (callback) callback();
      });
    }
  };

  React.useEffect(() => {
    if (visible) {
      animatedTranslateY.setValue(CLOSED_TRANSLATION);
      lastTranslation.current = CLOSED_TRANSLATION;
      animateTo(COLLAPSED_TRANSLATION, false);
    }
  }, [visible]);

  React.useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        animateTo(EXPANDED_TRANSLATION, true);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleClose = () => {
    animateTo(CLOSED_TRANSLATION, false, onClose);
  };

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        animatedTranslateY.stopAnimation((value) => {
          lastTranslation.current = value;
        });
      },
      onPanResponderMove: (evt, gestureState) => {
        let newTranslateY = lastTranslation.current + gestureState.dy;
        if (newTranslateY < 40) {
          newTranslateY = 40;
        }
        animatedTranslateY.setValue(newTranslateY);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const threshold = 60;
        if (Math.abs(gestureState.dy) < 5 && Math.abs(gestureState.dx) < 5) {
          const target = isExpanded ? COLLAPSED_TRANSLATION : EXPANDED_TRANSLATION;
          animateTo(target, !isExpanded);
          return;
        }

        if (gestureState.dy < -threshold) {
          animateTo(EXPANDED_TRANSLATION, true);
        } else if (gestureState.dy > threshold) {
          if (gestureState.dy > 120 && !isExpanded) {
            handleClose();
          } else {
            animateTo(COLLAPSED_TRANSLATION, false);
          }
        } else {
          const target = isExpanded ? EXPANDED_TRANSLATION : COLLAPSED_TRANSLATION;
          animateTo(target, isExpanded);
        }
      },
    })
  ).current;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.panelOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View style={[
              styles.panelContent, 
              { 
                height: screenHeight,
                transform: [{ translateY: animatedTranslateY }] 
              }
            ]}>
              {/* Drag Handle */}
              <View style={styles.dragHandleContainer} {...panResponder.panHandlers}>
                <View style={styles.dragHandle} />
              </View>

              {/* Header */}
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>{title}</Text>
                <TouchableOpacity onPress={handleClose} style={styles.panelCloseBtn}>
                  <Text style={styles.panelCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={{ flex: 1 }}
                contentContainerStyle={[styles.panelScroll, { paddingBottom: insets.bottom + 120 + keyboardHeight }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Checkbox
  checkboxOutline: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },

  // Circular button
  circularBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(168, 172, 181, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // PillTab
  pillTabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(23, 24, 25, 0.25)',
    borderRadius: 999,
    padding: 4,
    marginBottom: 20,
    width: '100%',
  },
  pillTabItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillTabItemActive: {
    backgroundColor: '#F4E11A',
  },
  pillTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C7CBD1',
  },
  pillTabTextActive: {
    color: '#1F2228',
  },

  // StatCapsule
  statCapsule: {
    backgroundColor: '#3D434D',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 90,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statCapsuleActive: {
    backgroundColor: '#F4E11A',
  },
  statCapsuleOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  statCapsuleDisabled: {
    backgroundColor: '#3D434D',
    opacity: 0.5,
  },
  statCapsuleValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statCapsuleValueActive: {
    color: '#1F2228',
  },
  statCapsuleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C7CBD1',
  },
  statCapsuleLabelActive: {
    color: '#1F2228',
  },

  // StatusBadge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
  },
  statusBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // ListCard
  listCard: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  listCardSelected: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  listCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardSub: {
    fontSize: 13,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 12,
    gap: 16,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA1AA',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 12,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#C7CBD1',
  },

  // GaugeChart
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 10,
    marginBottom: 20,
  },
  gaugeCenterLabel: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
  },
  gaugeValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  gaugeSub: {
    fontSize: 12,
    color: '#C7CBD1',
    fontWeight: '600',
    marginTop: 2,
  },

  // MapPinBadge
  mapPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F4E11A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#171819',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  mapPinHigh: {
    backgroundColor: '#171819',
    borderColor: '#F4E11A',
  },
  mapPinStar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F4E11A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#171819',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  mapPinText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#171819',
  },
  mapPinTextHigh: {
    color: '#FFFFFF',
  },

  // FloatingPanel
  panelOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 24, 25, 0.75)',
    justifyContent: 'flex-end',
  },
  panelContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  dragHandleContainer: {
    width: '100%',
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
    marginBottom: 8,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    marginBottom: 16,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2228',
  },
  panelCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelCloseText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2228',
  },
  panelScroll: {
    paddingBottom: 40,
  },
});
