import { Text as RNText, TextInput as RNTextInput } from 'react-native';
import { withFont } from './fonts';

/** 모든 텍스트에 Pretendard를 적용하는 래퍼 (react-native의 Text/TextInput 대체) */
export function Text({ style, ...rest }) {
  return <RNText {...rest} style={withFont(style)} />;
}

export function TextInput({ style, ...rest }) {
  return <RNTextInput {...rest} style={withFont(style)} />;
}
