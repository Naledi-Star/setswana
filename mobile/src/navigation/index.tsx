import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useAuth } from '../auth/AuthProvider'
import { Icon } from '../components/Icon'
import { Pitsi } from '../components/Pitsi'
import { colors, fonts, radius, spacing } from '../design/tokens'
import { OnboardingScreen } from '../screens/Onboarding'
import { ForgotPasswordScreen, SignInScreen, SignUpScreen, WelcomeScreen } from '../screens/auth/AuthScreens'
import { HomeScreen } from '../screens/learn/HomeScreen'
import { LessonsScreen } from '../screens/lessons/LessonsScreen'
import { LessonGuideScreen } from '../screens/lessons/LessonGuideScreen'
import { LessonScreen } from '../screens/lesson/LessonScreen'
import { CompleteScreen } from '../screens/lesson/CompleteScreen'
import { WordsScreen } from '../screens/words/WordsScreen'
import { WordDetailScreen } from '../screens/words/WordDetailScreen'
import { ReviewScreen } from '../screens/words/ReviewScreen'
import { ProgressScreen } from '../screens/progress/ProgressScreen'
import { SettingsScreen } from '../screens/settings/SettingsScreen'
import {
  AdminHomeScreen,
  ConfigAdminScreen,
  ExerciseEditorScreen,
  LessonEditorScreen,
  UnitEditorScreen,
  WordsAdminScreen,
} from '../screens/admin/AdminScreens'
import type {
  AdminStackParamList,
  AuthStackParamList,
  GuestStackParamList,
  LearnStackParamList,
  LearnScreenProps,
  LessonsScreenProps,
  LessonsStackParamList,
  ProgressStackParamList,
  TabParamList,
  WordsStackParamList,
} from './types'

const AuthStack = createNativeStackNavigator<AuthStackParamList>()
const LearnStackNav = createNativeStackNavigator<LearnStackParamList>()
const LessonsStackNav = createNativeStackNavigator<LessonsStackParamList>()
const WordsStackNav = createNativeStackNavigator<WordsStackParamList>()
const ProgressStackNav = createNativeStackNavigator<ProgressStackParamList>()
const AdminStackNav = createNativeStackNavigator<AdminStackParamList>()
const GuestStackNav = createNativeStackNavigator<GuestStackParamList>()
const Tabs = createBottomTabNavigator<TabParamList>()

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.paper,
    card: colors.paper,
    text: colors.ink,
    primary: colors.blue,
    border: colors.line,
  },
}

const stackOptions = { headerShown: false, contentStyle: { backgroundColor: colors.paper } }

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={stackOptions}>
      <AuthStack.Screen name="Welcome">
        {({ navigation }) => (
          <WelcomeScreen
            navigation={{ navigate: (screen) => navigation.navigate(screen) }}
          />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name="SignIn">
        {({ navigation }) => (
          <SignInScreen navigation={{ navigate: (screen) => navigation.navigate(screen) }} />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name="SignUp">
        {({ navigation }) => (
          <SignUpScreen
            navigation={{ navigate: (screen) => navigation.navigate(screen), goBack: navigation.goBack }}
          />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name="ForgotPassword">
        {({ navigation }) => <ForgotPasswordScreen navigation={{ goBack: navigation.goBack }} />}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  )
}

function LearnLesson({ route, navigation }: LearnScreenProps<'Lesson'>) {
  return (
    <LessonScreen
      lessonId={route.params.lessonId}
      onExit={() => navigation.goBack()}
      onReviewWords={() => navigation.getParent()?.navigate('WordsTab' as never)}
      onComplete={(summary, lessonTitle, nextLessonId) =>
        navigation.replace('Complete', { summary, lessonTitle, nextLessonId })
      }
    />
  )
}

function LearnComplete({ route, navigation }: LearnScreenProps<'Complete'>) {
  const { summary, lessonTitle, nextLessonId } = route.params
  return (
    <CompleteScreen
      summary={summary}
      lessonTitle={lessonTitle}
      nextLessonId={nextLessonId}
      onBack={() => navigation.popToTop()}
      onNext={() => {
        if (nextLessonId) navigation.replace('Lesson', { lessonId: nextLessonId })
        else navigation.popToTop()
      }}
    />
  )
}

function LearnNavigator() {
  return (
    <LearnStackNav.Navigator screenOptions={stackOptions}>
      <LearnStackNav.Screen name="Home" component={HomeScreen} />
      <LearnStackNav.Screen name="Lesson" component={LearnLesson} />
      <LearnStackNav.Screen
        name="Complete"
        component={LearnComplete}
        options={{ gestureEnabled: false }}
      />
      <LearnStackNav.Screen name="Settings" component={SettingsScreen} />
    </LearnStackNav.Navigator>
  )
}

function LessonsLesson({ route, navigation }: LessonsScreenProps<'Lesson'>) {
  return (
    <LessonScreen
      lessonId={route.params.lessonId}
      onExit={() => navigation.goBack()}
      onReviewWords={() => navigation.getParent()?.navigate('WordsTab' as never)}
      onComplete={(summary, lessonTitle, nextLessonId) =>
        navigation.replace('Complete', { summary, lessonTitle, nextLessonId })
      }
    />
  )
}

function LessonsComplete({ route, navigation }: LessonsScreenProps<'Complete'>) {
  const { summary, lessonTitle, nextLessonId } = route.params
  return (
    <CompleteScreen
      summary={summary}
      lessonTitle={lessonTitle}
      nextLessonId={nextLessonId}
      onBack={() => navigation.popToTop()}
      onNext={() => {
        if (nextLessonId) navigation.replace('Lesson', { lessonId: nextLessonId })
        else navigation.popToTop()
      }}
    />
  )
}

function LessonsNavigator() {
  return (
    <LessonsStackNav.Navigator screenOptions={stackOptions}>
      <LessonsStackNav.Screen name="Lessons" component={LessonsScreen} />
      <LessonsStackNav.Screen name="LessonGuide" component={LessonGuideScreen} />
      <LessonsStackNav.Screen name="Lesson" component={LessonsLesson} />
      <LessonsStackNav.Screen
        name="Complete"
        component={LessonsComplete}
        options={{ gestureEnabled: false }}
      />
    </LessonsStackNav.Navigator>
  )
}

function WordsNavigator() {
  return (
    <WordsStackNav.Navigator screenOptions={stackOptions}>
      <WordsStackNav.Screen name="Words" component={WordsScreen} />
      <WordsStackNav.Screen name="WordDetail" component={WordDetailScreen} />
      <WordsStackNav.Screen name="Review" component={ReviewScreen} />
    </WordsStackNav.Navigator>
  )
}

function ProgressNavigator() {
  return (
    <ProgressStackNav.Navigator screenOptions={stackOptions}>
      <ProgressStackNav.Screen name="Progress" component={ProgressScreen} />
    </ProgressStackNav.Navigator>
  )
}

function AdminNavigator() {
  return (
    <AdminStackNav.Navigator screenOptions={stackOptions}>
      <AdminStackNav.Screen name="AdminHome" component={AdminHomeScreen} />
      <AdminStackNav.Screen name="UnitEditor" component={UnitEditorScreen} />
      <AdminStackNav.Screen name="LessonEditor" component={LessonEditorScreen} />
      <AdminStackNav.Screen name="ExerciseEditor" component={ExerciseEditorScreen} />
      <AdminStackNav.Screen name="WordsAdmin" component={WordsAdminScreen} />
      <AdminStackNav.Screen name="ConfigAdmin" component={ConfigAdminScreen} />
    </AdminStackNav.Navigator>
  )
}

function tabIcon(name: 'home' | 'book' | 'cards' | 'chart' | 'admin') {
  return ({ color, size }: { color: string; size: number }) => (
    <Icon name={name} size={size} color={color} filled={false} />
  )
}

function MainTabs() {
  const { isAdmin } = useAuth()

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blueDark,
        tabBarInactiveTintColor: colors.navInactive,
        tabBarActiveBackgroundColor: colors.infoTint,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="LearnTab"
        component={LearnNavigator}
        options={{ title: 'Learn', tabBarIcon: tabIcon('home') }}
      />
      <Tabs.Screen
        name="LessonsTab"
        component={LessonsNavigator}
        options={{ title: 'Lessons', tabBarIcon: tabIcon('book') }}
      />
      <Tabs.Screen
        name="WordsTab"
        component={WordsNavigator}
        options={{ title: 'Words', tabBarIcon: tabIcon('cards') }}
      />
      <Tabs.Screen
        name="ProgressTab"
        component={ProgressNavigator}
        options={{ title: 'Progress', tabBarIcon: tabIcon('chart') }}
      />
      {isAdmin ? (
        <Tabs.Screen
          name="AdminTab"
          component={AdminNavigator}
          options={{ title: 'Admin', tabBarIcon: tabIcon('admin') }}
        />
      ) : null}
    </Tabs.Navigator>
  )
}

function GuestNavigator() {
  return (
    <GuestStackNav.Navigator screenOptions={stackOptions}>
      <GuestStackNav.Screen name="GuestHome" component={HomeScreen} />
      <GuestStackNav.Screen name="Lesson">
        {({ route, navigation }) => (
          <LessonScreen
            lessonId={route.params.lessonId}
            onExit={() => navigation.goBack()}
            onComplete={(summary, lessonTitle, nextLessonId) =>
              navigation.replace('Complete', { summary, lessonTitle, nextLessonId })
            }
          />
        )}
      </GuestStackNav.Screen>
      <GuestStackNav.Screen name="Complete" options={{ gestureEnabled: false }}>
        {({ route, navigation }) => {
          const { summary, lessonTitle, nextLessonId } = route.params
          return (
            <CompleteScreen
              summary={summary}
              lessonTitle={lessonTitle}
              nextLessonId={nextLessonId}
              onBack={() => navigation.popToTop()}
              onNext={() => navigation.popToTop()}
              onSignUp={() => navigation.navigate('GuestSignUp')}
            />
          )
        }}
      </GuestStackNav.Screen>
      <GuestStackNav.Screen name="GuestSignUp">
        {({ navigation }) => (
          <SignUpScreen
            guestMode
            navigation={{
              navigate: () => navigation.popToTop(),
              goBack: () => navigation.goBack(),
            }}
          />
        )}
      </GuestStackNav.Screen>
    </GuestStackNav.Navigator>
  )
}

function LoadingSplash() {
  return (
    <View style={styles.splash}>
      <Pitsi size={150} />
      <Text style={styles.splashWord}>Puo</Text>
      <Text style={styles.splashTag}>Setswana, one conversation at a time.</Text>
    </View>
  )
}

export function RootNavigator() {
  const { status, needsOnboarding } = useAuth()

  if (status === 'loading') return <LoadingSplash />
  if (status === 'signedOut') {
    return (
      <NavigationContainer theme={navTheme}>
        <AuthNavigator />
      </NavigationContainer>
    )
  }
  if (status === 'guest') {
    return (
      <NavigationContainer theme={navTheme}>
        <GuestNavigator />
      </NavigationContainer>
    )
  }
  if (needsOnboarding) return <OnboardingScreen />

  return (
    <NavigationContainer theme={navTheme}>
      <MainTabs />
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    height: 68,
    borderTopWidth: 1,
    borderTopColor: 'rgba(23,43,56,0.08)',
    backgroundColor: 'rgba(255,253,247,0.98)',
    paddingHorizontal: spacing.sm,
    paddingTop: 6,
  },
  tabItem: { borderRadius: radius.sm, marginHorizontal: 2 },
  tabLabel: { fontFamily: fonts.bodyBold, fontSize: 9, marginTop: 2 },
  splash: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  splashWord: {
    fontFamily: fonts.displayBlack,
    fontSize: 40,
    color: colors.navy,
    letterSpacing: -1.6,
  },
  splashTag: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
})
