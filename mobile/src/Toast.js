import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { colors, radius, shadow, space } from './theme';
import { Icon } from './ui';

const SHOW_MS = 2200;

const ToastContext = createContext({ show: () => {} });

/** 저장·수정 같은 결과를 잠깐 보여 주고 저절로 사라지는 알림. 어느 화면에서든 useToast().show('...') */
export function ToastProvider({ children }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  const show = useCallback(
    (message, kind = 'success') => {
      if (!message) return;
      clearTimeout(timer.current);
      setToast({ message, kind, id: Date.now() });
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }).start(({ finished }) => {
          if (finished) setToast(null);
        });
      }, SHOW_MS);
    },
    [opacity]
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo(() => ({ show }), [show]);
  const error = toast?.kind === 'error';

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 8) + 84 }]} pointerEvents="none">
          <Animated.View
            style={[styles.toast, error && styles.toastError, { opacity }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Icon name={error ? 'alert-circle' : 'checkmark-circle'} size={18} color={error ? colors.danger : colors.forest} />
            <Text style={[styles.text, error && styles.textError]}>{toast.message}</Text>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center', zIndex: 100 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    maxWidth: 520,
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.forestSoft,
    ...shadow.float
  },
  toastError: { backgroundColor: '#FDE8E8' },
  text: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.forestInk },
  textError: { color: colors.danger }
});
