import { Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { VoiceSearchBar } from '../VoiceSearchBar';
import { defaultVoiceSearchTexts as texts } from '../VoiceSearchDialog';

jest.mock('../../NativeVoiceToText');

const {
  default: native,
  emitResult,
  resetNativeMock,
} = jest.requireMock<typeof import('../../__mocks__/NativeVoiceToText')>(
  '../../NativeVoiceToText'
);

beforeEach(() => {
  resetNativeMock();
});

const emit = (fn: () => void) => act(async () => fn());
const openVoice = () =>
  fireEvent.press(screen.getByRole('button', { name: 'Search by voice' }));

describe('VoiceSearchBar text input', () => {
  it('renders the default placeholder', async () => {
    await render(<VoiceSearchBar />);
    expect(screen.getByPlaceholderText('Search')).toBeOnTheScreen();
  });

  it('manages its own value when uncontrolled', async () => {
    const onChangeText = jest.fn();
    await render(
      <VoiceSearchBar defaultValue="tea" onChangeText={onChangeText} />
    );
    const input = screen.getByPlaceholderText('Search');
    expect(input).toHaveDisplayValue('tea');

    await fireEvent.changeText(input, 'coffee');

    expect(input).toHaveDisplayValue('coffee');
    expect(onChangeText).toHaveBeenCalledWith('coffee');
  });

  it('follows the value prop when controlled', async () => {
    const onChangeText = jest.fn();
    const { rerender } = await render(
      <VoiceSearchBar value="one" onChangeText={onChangeText} />
    );
    const input = screen.getByPlaceholderText('Search');

    await fireEvent.changeText(input, 'two');
    expect(onChangeText).toHaveBeenCalledWith('two');
    expect(input).toHaveDisplayValue('one');

    await rerender(<VoiceSearchBar value="two" onChangeText={onChangeText} />);
    expect(input).toHaveDisplayValue('two');
  });

  it('calls onSearch and onSubmitEditing on keyboard submit', async () => {
    const onSearch = jest.fn();
    const onSubmitEditing = jest.fn();
    await render(
      <VoiceSearchBar onSearch={onSearch} onSubmitEditing={onSubmitEditing} />
    );
    const input = screen.getByPlaceholderText('Search');

    await fireEvent.changeText(input, 'shoes');
    await fireEvent(input, 'submitEditing', { nativeEvent: { text: 'shoes' } });

    expect(onSearch).toHaveBeenCalledWith('shoes');
    expect(onSubmitEditing).toHaveBeenCalledTimes(1);
  });

  it('passes extra TextInput props through', async () => {
    await render(<VoiceSearchBar placeholder="Find songs" testID="bar" />);
    expect(screen.getByTestId('bar')).toHaveProp('placeholder', 'Find songs');
  });
});

describe('VoiceSearchBar voice search', () => {
  it('does not listen until the mic is pressed', async () => {
    await render(<VoiceSearchBar />);
    expect(native.startListening).not.toHaveBeenCalled();
    expect(screen.queryByText(texts.listening)).toBeNull();
  });

  it('opens the dialog when the mic is pressed', async () => {
    await render(<VoiceSearchBar />);

    await openVoice();

    expect(native.startListening).toHaveBeenCalledTimes(1);
    expect(screen.getByText(texts.listening)).toBeOnTheScreen();
  });

  it('fills the field and searches with the voice result', async () => {
    const onSearch = jest.fn();
    const onChangeText = jest.fn();
    await render(
      <VoiceSearchBar onSearch={onSearch} onChangeText={onChangeText} />
    );
    await openVoice();

    await emit(() => emitResult('red sneakers', true));

    expect(screen.getByPlaceholderText('Search')).toHaveDisplayValue(
      'red sneakers'
    );
    expect(onChangeText).toHaveBeenCalledWith('red sneakers');
    expect(onSearch).toHaveBeenCalledWith('red sneakers');
    expect(screen.queryByText(texts.listening)).toBeNull();
  });

  it('only fills the field when fillOnly is set', async () => {
    const onSearch = jest.fn();
    await render(<VoiceSearchBar onSearch={onSearch} fillOnly />);
    await openVoice();

    await emit(() => emitResult('draft query', true));

    expect(screen.getByPlaceholderText('Search')).toHaveDisplayValue(
      'draft query'
    );
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('closes the dialog on cancel without changing the text', async () => {
    await render(<VoiceSearchBar defaultValue="keep me" />);
    await openVoice();

    await fireEvent.press(screen.getByRole('button', { name: texts.cancel }));

    expect(screen.queryByText(texts.listening)).toBeNull();
    expect(screen.getByPlaceholderText('Search')).toHaveDisplayValue('keep me');
  });

  it('can open the dialog again after it closed', async () => {
    await render(<VoiceSearchBar />);
    await openVoice();
    await emit(() => emitResult('first', true));

    await openVoice();

    expect(native.startListening).toHaveBeenCalledTimes(2);
  });

  it('forwards dialogProps to the dialog', async () => {
    await render(
      <VoiceSearchBar
        dialogProps={{ locale: 'fr-FR', texts: { listening: 'J’écoute…' } }}
      />
    );
    await openVoice();

    expect(native.startListening).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'fr-FR' })
    );
    expect(screen.getByText('J’écoute…')).toBeOnTheScreen();
  });

  it('forwards micButtonProps to the mic button', async () => {
    await render(
      <VoiceSearchBar micButtonProps={{ accessibilityLabel: 'Dictate' }} />
    );
    expect(screen.getByRole('button', { name: 'Dictate' })).toBeOnTheScreen();
  });

  it('renderMicButton replaces the mic and receives open()', async () => {
    await render(
      <VoiceSearchBar
        renderMicButton={({ open }) => <Text onPress={open}>talk</Text>}
      />
    );
    expect(
      screen.queryByRole('button', { name: 'Search by voice' })
    ).toBeNull();

    await fireEvent.press(screen.getByText('talk'));

    expect(native.startListening).toHaveBeenCalledTimes(1);
  });
});

describe('VoiceSearchBar search icon', () => {
  it('renders a custom search icon', async () => {
    await render(<VoiceSearchBar renderSearchIcon={() => <Text>🔍</Text>} />);
    expect(screen.getByText('🔍')).toBeOnTheScreen();
  });

  it('hides the search icon when showSearchIcon is false', async () => {
    const renderSearchIcon = jest.fn(() => <Text>🔍</Text>);
    await render(
      <VoiceSearchBar
        showSearchIcon={false}
        renderSearchIcon={renderSearchIcon}
      />
    );
    expect(screen.queryByText('🔍')).toBeNull();
    expect(renderSearchIcon).not.toHaveBeenCalled();
  });
});
