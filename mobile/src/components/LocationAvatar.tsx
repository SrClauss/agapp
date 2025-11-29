import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native'
import useAuthStore from "../stores/authStore"

export default function LocationAvatar() {
    const user = useAuthStore((state) => state.user)
    const initials = user?.full_name ? user.full_name.split(' ').map(s => s[0]).join('').slice(0,2).toUpperCase() : 'U'

    return (
        <View style={styles.container}>
            {user?.photo ? (
                <Image source={{ uri: user.photo }} style={styles.avatar} />
            ) : (
                <View style={styles.fallback}>
                    <Text style={styles.fallbackText}>{initials}</Text>
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: { alignItems: 'center', justifyContent: 'center' },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    fallback: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#EEE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fallbackText: { color: '#222', fontWeight: '600' },
})