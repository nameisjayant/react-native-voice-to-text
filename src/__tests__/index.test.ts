import * as lib from '../index';

jest.mock('../NativeVoiceToText');

describe('public API', () => {
  it.each([
    'SpeechToText',
    'useSpeechToText',
    'VoiceSearchDialog',
    'defaultVoiceSearchTexts',
    'VoiceSearchBar',
    'MicButton',
    'MicIcon',
    'SearchIcon',
    'defaultVoiceSearchTheme',
    'lightVoiceSearchTheme',
  ])('exports %s', (name) => {
    expect(lib).toHaveProperty(name);
    expect((lib as Record<string, unknown>)[name]).toBeDefined();
  });
});
