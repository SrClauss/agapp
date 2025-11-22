import * as Location from 'expo-location';

export async function requestAndGetLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission to access location was denied');
  }
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
  return location;
}

export async function geocodeAddress(address: string) {
  // We can use react-native-geocoding or a backend endpoint for geocoding to avoid exposing keys
  // This is a simple wrapper for the backend geocode endpoint if needed
  return null;
}

export default { requestAndGetLocation, geocodeAddress };
