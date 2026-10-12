import { Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  VoiceSearchDialog,
  defaultVoiceSearchTexts as texts,
  type VoiceSearchDialogProps,
  type VoiceSearchDialogRenderProps,
} from '../VoiceSearchDialog';

jest.mock('../../NativeVoiceToText');

const {
  default: native,
  emitError,
  emitResult,
  resetNativeMock,
} = jest.requireMock<typeof import('../../__mocks__/NativeVoiceToText')>(
  '../../NativeVoiceToText'
);

beforeEach(() => {
  resetNativeMock();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

async function renderDialog(props: Partial<VoiceSearchDialogProps> = {}) {
  const onResult = jest.fn();
  const onClose = jest.fn();
  const utils = await render(
    <VoiceSearchDialog
      visible
      onResult={onResult}
      onClose={onClose}
      {...props}
    />
  );
  return { ...utils, onResult, onClose };
}

const emit = (fn: () => void) => act(async () => fn());
const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

describe('VoiceSearchDialog', () => {
  it('starts listening as soon as it becomes visible', async () => {
    await renderDialog({ locale: 'en-IN' });

    expect(native.startListening).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'en-IN' })
    );
    expect(screen.getByText(texts.listening)).toBeOnTheScreen();
    expect(screen.getByText(texts.speakNow)).toBeOnTheScreen();
  });

  it('shows the starting text while the recognizer is spinning up', async () => {
    native.startListening.mockReturnValue(new Promise(() => {}));
    await renderDialog();

    expect(screen.getByText(texts.starting)).toBeOnTheScreen();
  });

  it('does not start and renders nothing while hidden', async () => {
    await renderDialog({ visible: false });

    expect(native.startListening).not.toHaveBeenCalled();
    expect(screen.queryByText(texts.listening)).toBeNull();
  });

  it('cancels the session when hidden by the parent', async () => {
    const { rerender, onClose, onResult } = await renderDialog();

    await rerender(
      <VoiceSearchDialog
        visible={false}
        onResult={onResult}
        onClose={onClose}
      />
    );

    expect(native.cancelListening).toHaveBeenCalledTimes(1);
    expect(onResult).not.toHaveBeenCalled();
  });

  it('shows the live transcript and hides the "speak now" hint', async () => {
    await renderDialog();

    await emit(() => emitResult('weather in delhi'));

    expect(screen.getByText('“weather in delhi”')).toBeOnTheScreen();
    expect(screen.queryByText(texts.speakNow)).toBeNull();
  });

  it('hides the transcript when showTranscript is false', async () => {
    await renderDialog({ showTranscript: false });

    await emit(() => emitResult('secret'));

    expect(screen.queryByText('“secret”')).toBeNull();
  });

  it('delivers the result and closes on a final result', async () => {
    const { onResult, onClose } = await renderDialog();

    await emit(() => emitResult('pizza', true));

    expect(onResult).toHaveBeenCalledWith('pizza');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onResult.mock.invocationCallOrder[0]).toBeLessThan(
      onClose.mock.invocationCallOrder[0]!
    );
  });

  it('auto-closes after silence and delivers what was heard', async () => {
    const { onResult, onClose } = await renderDialog();
    await emit(() => emitResult('nearby atm'));

    await advance(2000);
    expect(screen.getByText(texts.processing)).toBeOnTheScreen();

    await advance(1500);
    expect(onResult).toHaveBeenCalledWith('nearby atm');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes without a result when the user never speaks', async () => {
    const { onResult, onClose } = await renderDialog();

    await advance(6000 + 1500);

    expect(onResult).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a retry state instead of closing when closeOnNoSpeech is false', async () => {
    const { onClose } = await renderDialog({ closeOnNoSpeech: false });

    await emit(() => emitError('no_match'));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(texts.noSpeech)).toBeOnTheScreen();
    expect(screen.getByText(texts.tapToRetry)).toBeOnTheScreen();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Start listening' })
    );

    expect(native.startListening).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(texts.noSpeech)).toBeNull();
    expect(screen.getByText(texts.listening)).toBeOnTheScreen();
  });

  it('shows the permission message and stays open when permission is denied', async () => {
    native.hasPermissions.mockResolvedValue(false);
    native.requestPermissions.mockResolvedValue(false);

    const { onClose } = await renderDialog();

    expect(screen.getByText(texts.permissionDenied)).toBeOnTheScreen();
    expect(screen.getByText(texts.tapToRetry)).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the generic error and lets the user retry', async () => {
    const { onClose } = await renderDialog();

    await emit(() => emitError('network'));

    expect(screen.getByText(texts.error)).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Start listening' })
    );
    expect(native.startListening).toHaveBeenCalledTimes(2);
    expect(screen.getByText(texts.listening)).toBeOnTheScreen();
  });

  it('tapping the mic while listening stops early', async () => {
    await renderDialog();
    await emit(() => emitResult('stop here'));

    await fireEvent.press(
      screen.getByRole('button', { name: 'Stop listening' })
    );

    expect(native.stopListening).toHaveBeenCalledTimes(1);
    expect(screen.getByText(texts.processing)).toBeOnTheScreen();
  });

  it('tapping the mic while processing does nothing', async () => {
    await renderDialog();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Stop listening' })
    );

    await fireEvent.press(
      screen.getByRole('button', { name: 'Start listening' })
    );

    expect(native.stopListening).toHaveBeenCalledTimes(1);
    expect(native.startListening).toHaveBeenCalledTimes(1);
  });

  it('the cancel button aborts and closes without a result', async () => {
    const { onResult, onClose } = await renderDialog();
    await emit(() => emitResult('half'));

    await fireEvent.press(screen.getByRole('button', { name: texts.cancel }));

    expect(native.cancelListening).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onResult).not.toHaveBeenCalled();
  });

  it('hides the cancel button when showCancelButton is false', async () => {
    await renderDialog({ showCancelButton: false });

    expect(screen.queryByText(texts.cancel)).toBeNull();
  });

  it('uses custom texts merged over the defaults', async () => {
    await renderDialog({
      texts: { listening: 'Sun raha hoon…', cancel: 'Band' },
    });

    expect(screen.getByText('Sun raha hoon…')).toBeOnTheScreen();
    expect(screen.getByText('Band')).toBeOnTheScreen();
    expect(screen.getByText(texts.speakNow)).toBeOnTheScreen();
  });

  it('applies theme colors and font family', async () => {
    await renderDialog({
      theme: { titleColor: '#123456', fontFamily: 'Inter' },
      titleStyle: { fontSize: 30 },
    });

    expect(screen.getByText(texts.listening)).toHaveStyle({
      color: '#123456',
      fontFamily: 'Inter',
      fontSize: 30,
    });
  });

  it('uses the error color for the title in the error state', async () => {
    await renderDialog({ theme: { errorColor: '#FF0000' } });

    await emit(() => emitError('server'));

    expect(screen.getByText(texts.error)).toHaveStyle({ color: '#FF0000' });
  });

  it('renders a custom mic icon with size, color and status', async () => {
    const renderMicIcon = jest.fn(() => <Text>custom-mic</Text>);
    await renderDialog({
      renderMicIcon,
      theme: { micSize: 100, micIconColor: '#00FF00' },
    });

    expect(screen.getByText('custom-mic')).toBeOnTheScreen();
    expect(renderMicIcon).toHaveBeenLastCalledWith({
      size: 42,
      color: '#00FF00',
      status: 'listening',
    });
  });

  it('renderContent replaces the default UI and receives working controls', async () => {
    const renderContent = jest.fn(
      ({ status, transcript, cancel }: VoiceSearchDialogRenderProps) => (
        <>
          <Text>{`status:${status}`}</Text>
          <Text>{`heard:${transcript}`}</Text>
          <Text onPress={cancel}>close</Text>
        </>
      )
    );
    const { onClose } = await renderDialog({ renderContent });

    expect(screen.queryByText(texts.listening)).toBeNull();
    expect(screen.getByText('status:listening')).toBeOnTheScreen();

    await emit(() => emitResult('hi'));
    expect(screen.getByText('heard:hi')).toBeOnTheScreen();
    expect(renderContent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'listening',
        transcript: 'hi',
        noSpeech: false,
        error: null,
        texts: expect.objectContaining({ listening: texts.listening }),
        theme: expect.objectContaining({ micSize: 76 }),
      })
    );

    await fireEvent.press(screen.getByText('close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(native.cancelListening).toHaveBeenCalled();
  });

  it('renderContent stop and retry drive the session', async () => {
    let controls!: { stop: () => void; retry: () => void };
    await renderDialog({
      closeOnNoSpeech: false,
      renderContent: (p) => {
        controls = p;
        return null;
      },
    });

    await act(async () => controls.stop());
    expect(native.stopListening).toHaveBeenCalledTimes(1);

    await advance(1500);
    await act(async () => controls.retry());
    expect(native.startListening).toHaveBeenCalledTimes(2);
  });
});
