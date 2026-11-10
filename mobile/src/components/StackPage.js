import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, shadow, space, type } from '../theme';
import { Icon, Screen } from '../ui';

export function StackPage({ title, children, contentStyle, embed }) {
  const navigation = useNavigation();
  if (embed) {
    return (
      <Screen scroll inHub contentStyle={contentStyle}>
        {children}
      </Screen>
    );
  }
  return (
    <Screen scroll contentStyle={contentStyle}>
      <View style={styles.head}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          hitSlop={8}
        >
          <Icon name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        {title ? <Text style={styles.title}>{title}</Text> : null}
      </View>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.sm, marginBottom: space.md },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    ...shadow.card
  },
  title: { ...type.title, fontSize: 28, lineHeight: 34 }
});
