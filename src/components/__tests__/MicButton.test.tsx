import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MicButton } from '../MicButton';
import { MicIcon, SearchIcon } from '../MicIcon';

describe('MicButton', () => {
  it('is an accessible button with a default label', async () => {
    await render(<MicButton />);
    expect(
      screen.getByRole('button', { name: 'Search by voice' })
    ).toBeOnTheScreen();
  });

  it('calls onPress', async () => {
    const onPress = jest.fn();
    await render(<MicButton onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', async () => {
    const onPress = jest.fn();
    await render(<MicButton onPress={onPress} disabled />);

    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('sizes itself as a circle with the given background', async () => {
    await render(<MicButton size={50} backgroundColor="#EEE" />);
    expect(screen.getByRole('button')).toHaveStyle({
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: '#EEE',
    });
  });

  it('lets the style prop override defaults', async () => {
    await render(<MicButton style={{ backgroundColor: 'red', margin: 4 }} />);
    expect(screen.getByRole('button')).toHaveStyle({
      backgroundColor: 'red',
      margin: 4,
    });
  });

  it('accepts a custom accessibility label and icon', async () => {
    await render(
      <MicButton accessibilityLabel="Dictate" icon={<Text>🎤</Text>} />
    );
    expect(screen.getByRole('button', { name: 'Dictate' })).toBeOnTheScreen();
    expect(screen.getByText('🎤')).toBeOnTheScreen();
  });
});

describe('icons', () => {
  it('MicIcon renders at the requested size', async () => {
    await render(<MicIcon size={30} color="#000" style={{ margin: 2 }} />);
    expect(screen.root).toHaveStyle({ width: 30, height: 30, margin: 2 });
  });

  it('SearchIcon renders at the requested size', async () => {
    await render(<SearchIcon size={18} />);
    expect(screen.root).toHaveStyle({ width: 18, height: 18 });
  });
});
