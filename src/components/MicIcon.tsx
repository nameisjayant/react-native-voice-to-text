import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export type MicIconProps = {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/** Microphone glyph drawn with plain Views, so no SVG/icon dependency is needed. */
export function MicIcon({ size = 24, color = '#FFFFFF', style }: MicIconProps) {
  const stroke = Math.max(1.5, size * 0.085);
  const capsuleW = size * 0.36;
  const capsuleH = size * 0.56;
  const holderW = size * 0.62;
  const holderH = size * 0.4;

  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <View
        style={[
          styles.abs,
          styles.top,
          {
            width: capsuleW,
            height: capsuleH,
            left: (size - capsuleW) / 2,
            borderRadius: capsuleW / 2,
            backgroundColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.abs,
          styles.noTopBorder,
          {
            width: holderW,
            height: holderH,
            left: (size - holderW) / 2,
            top: size * 0.32,
            borderWidth: stroke,
            borderColor: color,
            borderBottomLeftRadius: holderW / 2,
            borderBottomRightRadius: holderW / 2,
          },
        ]}
      />
      <View
        style={[
          styles.abs,
          {
            width: stroke,
            height: size * 0.16,
            left: (size - stroke) / 2,
            top: size * 0.32 + holderH - stroke / 2,
            backgroundColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.abs,
          styles.bottom,
          {
            width: size * 0.38,
            height: stroke,
            left: (size - size * 0.38) / 2,
            borderRadius: stroke / 2,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

export type SearchIconProps = MicIconProps;

/** Magnifier glyph drawn with plain Views. */
export function SearchIcon({
  size = 20,
  color = '#5F6368',
  style,
}: SearchIconProps) {
  const stroke = Math.max(1.5, size * 0.11);
  const ring = size * 0.68;
  const handle = size * 0.36;

  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <View
        style={[
          styles.abs,
          styles.topLeft,
          {
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            borderWidth: stroke,
            borderColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.abs,
          {
            width: handle,
            height: stroke,
            borderRadius: stroke / 2,
            backgroundColor: color,
            left: ring * 0.78,
            top: ring * 0.92,
            transform: [{ rotate: '45deg' }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  top: { top: 0 },
  bottom: { bottom: 0 },
  topLeft: { top: 0, left: 0 },
  noTopBorder: { borderTopWidth: 0 },
});
