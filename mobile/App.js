import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from './src/Text';
import { NavigationContainer, DefaultTheme, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { FONT_FILES } from './src/fonts';
import { AppSplash, SplashBase } from './src/components/AppSplash';
import { useGuide } from './src/GuideContext';
import { handleIncomingUrl, subscribePendingShare, takePendingShare } from './src/shareLink';
import ImportShareScreen from './src/screens/ImportShareScreen';
import { AuthProvider, useAuth } from './src/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';
import { GuideProvider } from './src/GuideContext';
import { ToastProvider } from './src/Toast';
import { LayoutProvider } from './src/layout';
import HomeScreen from './src/screens/HomeScreen';
import TravelHubScreen from './src/screens/TravelHubScreen';
import MapHubScreen from './src/screens/MapHubScreen';
import RecordHubScreen from './src/screens/RecordHubScreen';
import ToolsHubScreen from './src/screens/ToolsHubScreen';
import { AppTabBar } from './src/components/AppTabBar';
import PlaceInfoScreen from './src/screens/PlaceInfoScreen';
import { colors } from './src/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.card,
    text: colors.ink,
    border: colors.line,
    primary: colors.accent
  }
};

function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      sceneContainerStyle={{ flex: 1, backgroundColor: colors.bg, overflow: 'hidden' }}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        freezeOnBlur: true
      }}
      tabBar={(props) => <AppTabBar {...props} insets={insets} />}
    >
      <Tab.Screen name="홈" component={HomeScreen} />
      <Tab.Screen name="여행" component={TravelHubScreen} />
      <Tab.Screen name="지도" component={MapHubScreen} />
      <Tab.Screen name="기록" component={RecordHubScreen} />
      <Tab.Screen name="도구" component={ToolsHubScreen} />
    </Tab.Navigator>
  );
}

function RootNav() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="장소" component={PlaceInfoScreen} />
      <Stack.Screen name="공유 가져오기" component={ImportShareScreen} />
    </Stack.Navigator>
  );
}

/**
 * 공유 링크(honeymoon://share/…)로 앱이 열리면 가져오기 화면으로 보낸다.
 * 로그인·데이터 로딩 전에 열린 링크는 대기해 두었다가 이 컴포넌트가 나타나는 시점에 처리한다.
 */
function ShareLinkListener() {
  const navigation = useNavigation();
  useEffect(() => {
    const open = (token) => token && navigation.navigate('공유 가져오기', { token });
    open(takePendingShare());
    return subscribePendingShare(() => open(takePendingShare()));
  }, [navigation]);
  return null;
}

/**
 * 여행 데이터 로딩이 끝날 때까지 시작 화면을 유지한다.
 * 로딩 중에는 하단 탭을 포함한 앱 본체를 아예 그리지 않아, 탭 바가 시작 화면 위·아래로 비치지 않게 한다.
 */
function GuideGate() {
  const { loading } = useGuide();
  return (
    <>
      {loading ? null : (
        <>
          <RootNav />
          <ShareLinkListener />
        </>
      )}
      <AppSplash ready={!loading} />
    </>
  );
}

/** 로그인 여부에 따라 로그인 화면 또는 앱 본체를 보여 준다 */
function AuthGate() {
  const { session, loading, mustChangePassword } = useAuth();
  if (loading) return <SplashBase />;
  return (
    <>
      <StatusBar style="dark" />
      {session && mustChangePassword ? (
        // 운영자가 임시 비밀번호를 준 계정은 새 비밀번호를 정해야만 앱을 쓸 수 있다
        <ChangePasswordScreen forced />
      ) : session ? (
        <GuideProvider key={session.user.id}>
          <GuideGate />
        </GuideProvider>
      ) : (
        <LoginScreen />
      )}
    </>
  );
}

function AppNavigation() {
  return (
    <NavigationContainer theme={navTheme}>
      <LayoutProvider>
        <AuthProvider>
          <ToastProvider>
            <AuthGate />
          </ToastProvider>
        </AuthProvider>
      </LayoutProvider>
    </NavigationContainer>
  );
}

/** 웹: 좁으면 미리보기 프레임, 넓으면(폴더·태블릿) 전체 화면 */
const WEB_PREVIEW_MAX_WIDTH = 480;

function WebShell({ children }) {
  const { width: winW, height: winH } = useWindowDimensions();
  const fullBleed = winW >= WEB_PREVIEW_MAX_WIDTH;
  const [frame, setFrame] = useState(() => ({
    width: Math.min(winW, 390),
    height: Math.min(winH, 844)
  }));

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const style = document.createElement('style');
    style.setAttribute('data-honeymoon-preview', 'true');
    style.textContent = fullBleed
      ? 'html,body,#root{height:100%;margin:0;background:#F7F9FB;} [role="tablist"]{position:absolute!important;border-top:none!important;background:transparent!important;box-shadow:none!important;}'
      : 'html,body,#root{height:100%;margin:0;background:#10263F;overflow:hidden;} [role="tablist"]{position:absolute!important;border-top:none!important;background:transparent!important;box-shadow:none!important;}';
    document.head.appendChild(style);
    const fit = () => {
      if (window.innerWidth >= WEB_PREVIEW_MAX_WIDTH) return;
      const width = Math.max(320, Math.min(390, window.innerWidth - 16));
      const height = Math.max(560, Math.min(844, window.innerHeight - 48));
      setFrame({ width, height });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => {
      style.remove();
      window.removeEventListener('resize', fit);
    };
  }, [fullBleed]);

  if (fullBleed) {
    return <View style={styles.fullBleed}>{children}</View>;
  }

  return (
    <View style={styles.stage}>
      <Text style={styles.caption}>Android 앱 미리보기 · {frame.width}×{frame.height}</Text>
      <View style={[styles.phone, { width: frame.width, height: frame.height }]}>
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>9:41</Text>
          <Text style={styles.statusText}>LTE</Text>
        </View>
        <View style={styles.screen}>{children}</View>
        <View style={styles.homeBar} />
      </View>
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);

  // 링크로 앱이 열렸을 때(콜드 스타트)와 이미 실행 중일 때 모두 받는다
  useEffect(() => {
    Linking.getInitialURL().then((url) => url && handleIncomingUrl(url)).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => handleIncomingUrl(url));
    return () => sub.remove();
  }, []);

  if (!fontsLoaded && !fontError) return <SplashBase />;

  const app = <AppNavigation />;
  const root = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>{app}</SafeAreaProvider>
    </GestureHandlerRootView>
  );

  if (Platform.OS !== 'web') {
    return root;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <WebShell>{app}</WebShell>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fullBleed: { flex: 1, backgroundColor: colors.bg },
  stage: {
    flex: 1,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8
  },
  caption: { color: '#888', fontSize: 12, marginBottom: 8 },
  phone: {
    backgroundColor: '#000',
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#222'
  },
  statusBar: {
    height: 32,
    backgroundColor: colors.bg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  statusText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  screen: { flex: 1, overflow: 'hidden' },
  homeBar: { height: 20, backgroundColor: '#FFFFFF' }
});
