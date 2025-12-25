import * as Location from 'expo-location';

export async function requestAndGetLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission to access location was denied');
  }
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
  return location;
}

export async function geocodeAddress(address: string): Promise<Location.LocationGeocodedLocation[]> {
  try {
    const results = await Location.geocodeAsync(address);
    return results;
  } catch (error) {
    console.error('Geocoding failed:', error);
    return [];
  }
}

export async function searchCEPByAddress(uf: string, cidade: string, logradouro: string): Promise<any[]> {
  try {
    const url = `https://viacep.com.br/ws/${uf}/${cidade}/${logradouro}/json/`;
    const response = await fetch(url);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('ViaCEP search failed:', error);
    return [];
  }
}

export default { requestAndGetLocation, geocodeAddress, searchCEPByAddress };
