import { colors } from '@kiwanja/client';
import { View } from 'react-native';
import { PlayerMarket } from '@/components/PlayerMarket';

export default function Players() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingHorizontal: 16, paddingTop: 12 }}>
      <PlayerMarket />
    </View>
  );
}
