import { useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  MicButton,
  VoiceSearchBar,
  VoiceSearchDialog,
  lightVoiceSearchTheme,
} from '@nameisjayant/react-native-voice-to-text';

const ITEMS = [
  'Find restaurants near me',
  'Pizza places open now',
  'Coffee shops',
  'Sushi delivery',
  'Indian restaurants',
  'Best burgers in town',
  'Vegan cafes',
  'Bakeries near me',
];

export default function App() {
  return (
    <SafeAreaProvider>
      <Demo />
    </SafeAreaProvider>
  );
}

function Demo() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [light, setLight] = useState(false);

  // Second demo: your own search field + the dialog on its own.
  const [ownQuery, setOwnQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const results = ITEMS.filter((item) =>
    item.toLowerCase().includes(submitted.trim().toLowerCase())
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.section}>
        <Text style={styles.heading}>VoiceSearchBar</Text>
        <VoiceSearchBar
          value={query}
          onChangeText={setQuery}
          onSearch={setSubmitted}
          placeholder="Search restaurants"
          dialogProps={{
            theme: light ? lightVoiceSearchTheme : undefined,
            silenceTimeout: 2000,
          }}
        />
        <View style={styles.row}>
          <Text style={styles.label}>Light dialog theme</Text>
          <Switch value={light} onValueChange={setLight} />
        </View>
        <Text style={styles.label}>
          Searching for: {submitted ? `“${submitted}”` : '—'}
        </Text>
      </View>

      <FlatList
        style={styles.list}
        data={results}
        keyExtractor={(item) => item}
        renderItem={({ item }) => <Text style={styles.item}>{item}</Text>}
      />

      <View style={styles.section}>
        <Text style={styles.heading}>Your own field + VoiceSearchDialog</Text>
        <View style={styles.ownBar}>
          <TextInput
            style={styles.ownInput}
            value={ownQuery}
            onChangeText={setOwnQuery}
            placeholder="Type or tap the mic"
            placeholderTextColor="#8A8F98"
          />
          <MicButton
            size={40}
            backgroundColor="#6C4DFF"
            iconColor="#FFFFFF"
            onPress={() => setDialogOpen(true)}
          />
        </View>
      </View>

      <VoiceSearchDialog
        visible={dialogOpen}
        onResult={setOwnQuery}
        onClose={() => setDialogOpen(false)}
        position="bottom"
        animationType="slide"
        closeOnNoSpeech={false}
        theme={{
          backgroundColor: '#14112B',
          primaryColor: '#6C4DFF',
          pulseColor: 'rgba(108, 77, 255, 0.3)',
          borderRadius: 28,
        }}
        texts={{ listening: 'I’m all ears…', speakNow: 'Say something' }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  section: { padding: 16, gap: 12 },
  heading: { fontSize: 18, fontWeight: '600', color: '#202124' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { fontSize: 14, color: '#5F6368' },
  list: { flex: 1, paddingHorizontal: 16 },
  item: {
    paddingVertical: 12,
    fontSize: 16,
    color: '#202124',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  ownBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D0D4DC',
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 4,
  },
  ownInput: { flex: 1, fontSize: 16, color: '#202124' },
});
