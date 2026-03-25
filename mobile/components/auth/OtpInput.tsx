import React, { useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Platform,
} from 'react-native';
import { colors, radius } from '@/constants/theme';

interface OtpInputProps {
  value: string;
  onChange: (v: string) => void;
  hasError: boolean;
}

export function OtpInput({ value, onChange, hasError }: OtpInputProps) {
  const refs = useRef<(TextInput | null)[]>([]);

  const handleChange = (index: number, text: string) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = (value.slice(0, index) + digit + value.slice(index + 1)).slice(0, 6);
    onChange(next);
    if (digit && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace') {
      if (!value[index] && index > 0) {
        refs.current[index - 1]?.focus();
        onChange(value.slice(0, index - 1) + value.slice(index));
      } else if (value[index]) {
        onChange(value.slice(0, index) + value.slice(index + 1));
      }
    }
  };

  return (
    <View style={styles.row}>
      {Array.from({ length: 6 }).map((_, i) => (
        <TextInput
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          style={[
            styles.box,
            value[i] ? styles.boxFilled : null,
            hasError ? styles.boxError : null,
          ]}
          value={value[i] || ''}
          onChangeText={(t) => handleChange(i, t)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
          keyboardType="number-pad"
          maxLength={1}
          textContentType="oneTimeCode"
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          selectTextOnFocus
          caretHidden
          cursorColor={colors.primary}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  box: {
    width: 46,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  boxFilled: {
    borderColor: 'rgba(124,58,237,0.7)',
  },
  boxError: {
    borderColor: 'rgba(239,68,68,0.55)',
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
});
