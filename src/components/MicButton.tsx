import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MicIcon } from './MicIcon';

export type MicButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  /** Diameter of the button. */
  size?: number;
  iconColor?: string;
  backgroundColor?: string;
  pressedOpacity?: number;
  style?: StyleProp<ViewStyle>;
  /** Replace the default mic glyph with your own icon. */
  icon?: ReactNode;
};

export function MicButton({
  size = 40,
  iconColor = '#5F6368',
  backgroundColor = 'transparent',
  pressedOpacity = 0.6,
  style,
  icon,
  accessibilityLabel = 'Search by voice',
  hitSlop = 8,
  ...rest
}: MicButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          opacity: pressed ? pressedOpacity : 1,
        },
        style,
      ]}
      {...rest}
    >
      {icon ?? <MicIcon size={size * 0.5} color={iconColor} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
