import { defaultVoiceSearchTheme, lightVoiceSearchTheme } from '../theme';

describe('themes', () => {
  it('light theme defines every key of the default theme', () => {
    expect(Object.keys(lightVoiceSearchTheme).sort()).toEqual(
      Object.keys(defaultVoiceSearchTheme).sort()
    );
  });

  it('light theme keeps the default sizing', () => {
    expect(lightVoiceSearchTheme.micSize).toBe(defaultVoiceSearchTheme.micSize);
    expect(lightVoiceSearchTheme.borderRadius).toBe(
      defaultVoiceSearchTheme.borderRadius
    );
  });

  it('light theme uses a light surface', () => {
    expect(lightVoiceSearchTheme.backgroundColor).toBe('#FFFFFF');
    expect(lightVoiceSearchTheme.backgroundColor).not.toBe(
      defaultVoiceSearchTheme.backgroundColor
    );
  });
});
