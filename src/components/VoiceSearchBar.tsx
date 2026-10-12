import { useState, type ReactNode } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { MicButton, type MicButtonProps } from './MicButton';
import { SearchIcon } from './MicIcon';
import {
  VoiceSearchDialog,
  type VoiceSearchDialogProps,
} from './VoiceSearchDialog';

export type VoiceSearchBarProps = Omit<
  TextInputProps,
  'style' | 'value' | 'defaultValue' | 'onChangeText'
> & {
  /** Controlled value. Omit to let the bar manage its own text. */
  value?: string;
  defaultValue?: string;
  onChangeText?: (text: string) => void;
  /** Called on keyboard submit and after a voice result fills the field. */
  onSearch?: (text: string) => void;
  /** Fill the field with the voice result but don't call onSearch. Default false. */
  fillOnly?: boolean;

  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  showSearchIcon?: boolean;
  searchIconColor?: string;
  renderSearchIcon?: () => ReactNode;

  micButtonProps?: Partial<MicButtonProps>;
  /** Replace the mic button. Call `open` to show the voice dialog. */
  renderMicButton?: (props: { open: () => void }) => ReactNode;
  /** Customise the listening dialog (theme, texts, timeouts, locale…). */
  dialogProps?: Partial<
    Omit<VoiceSearchDialogProps, 'visible' | 'onResult' | 'onClose'>
  >;
};

export function VoiceSearchBar({
  value,
  defaultValue = '',
  onChangeText,
  onSearch,
  fillOnly = false,
  containerStyle,
  inputStyle,
  showSearchIcon = true,
  searchIconColor = '#5F6368',
  renderSearchIcon,
  micButtonProps,
  renderMicButton,
  dialogProps,
  placeholder = 'Search',
  onSubmitEditing,
  ...inputProps
}: VoiceSearchBarProps) {
  const [innerValue, setInnerValue] = useState(defaultValue);
  const [dialogVisible, setDialogVisible] = useState(false);
  const text = value ?? innerValue;

  const setText = (next: string) => {
    if (value === undefined) setInnerValue(next);
    onChangeText?.(next);
  };

  const open = () => setDialogVisible(true);

  return (
    <View style={[styles.container, containerStyle]}>
      {showSearchIcon
        ? (renderSearchIcon?.() ?? (
            <SearchIcon size={18} color={searchIconColor} style={styles.icon} />
          ))
        : null}
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor="#80868B"
        returnKeyType="search"
        onSubmitEditing={(e) => {
          onSearch?.(text);
          onSubmitEditing?.(e);
        }}
        style={[styles.input, inputStyle]}
        {...inputProps}
      />
      {renderMicButton ? (
        renderMicButton({ open })
      ) : (
        <MicButton size={36} onPress={open} {...micButtonProps} />
      )}
      <VoiceSearchDialog
        {...dialogProps}
        visible={dialogVisible}
        onResult={(result) => {
          setText(result);
          if (!fillOnly) onSearch?.(result);
        }}
        onClose={() => setDialogVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F3F4',
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 6,
    minHeight: 48,
  },
  icon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#202124',
    paddingVertical: 10,
  },
});
