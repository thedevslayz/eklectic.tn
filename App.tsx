import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, Image,
    KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator, StatusBar,
    Animated, Dimensions, Pressable, LinearGradient
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

const { width: SW } = Dimensions.get('window');
const LOGO = require('./assets/logo.png');
const API_KEY = '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';
const MODEL = 'openai/gpt-4o-mini';

type Msg = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    imageUri?: string;
    imageBase64?: string;
    ts: number;
};

const SYSTEM_PROMPT = {
    role: 'system',
    content: 'You are EKLECTIC AI, the intelligent assistant of EKLECTIC — a leader in digital content, telecom payments, and monetization. Founded in 2019, EKLECTIC covers 6 countries, 26 carriers, 6M+ transactions/month, 1.8M+ subscribers. Products: Direct Carrier Billing, Premium SMS, Voice, USSD Wallet, Digital Ticketing, Apps, Digital Marketing. Be concise, professional, and helpful. Answer in the language the user writes in.',
};

const TypingDots = () => {
    const d1 = useRef(new Animated.Value(0.3)).current;
    const d2 = useRef(new Animated.Value(0.3)).current;
    const d3 = useRef(new Animated.Value(0.3)).current;
    useEffect(() => {
        const run = (v: Animated.Value, delay: number) =>
            Animated.loop(Animated.sequence([
                Animated.delay(delay),
                Animated.timing(v, { toValue: 1, duration: 350, useNativeDriver: true }),
                Animated.timing(v, { toValue: 0.3, duration: 350, useNativeDriver: true }),
            ])).start();
        run(d1, 0); run(d2, 150); run(d3, 300);
    }, []);
    const ds = (v: Animated.Value) => ({ width: 7, height: 7, borderRadius: 4, backgroundColor: '#c77dff', marginHorizontal: 3, opacity: v });
    return (
        <View style={st.typingRow}>
            <Image source={LOGO} style={st.typingAvatar} />
            <View style={st.typingBubble}>
                <Animated.View style={ds(d1)} />
                <Animated.View style={ds(d2)} />
                <Animated.View style={ds(d3)} />
            </View>
        </View>
    );
};

const fmtTime = (t: number) => {
    const d = new Date(t);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

export default function App() {
    const [msgs, setMsgs] = useState<Msg[]>([]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [img, setImg] = useState<{ uri: string; b64: string } | null>(null);
    const listRef = useRef<FlatList>(null);

    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            const d = await AsyncStorage.getItem('@ek_chat_v4');
            if (d) setMsgs(JSON.parse(d));
            else setMsgs([{ id: '1', role: 'assistant', content: 'Welcome to EKLECTIC AI. How can I help you today?', ts: Date.now() }]);
        } catch (_) {}
    };

    const save = async (m: Msg[]) => {
        try { await AsyncStorage.setItem('@ek_chat_v4', JSON.stringify(m)); } catch (_) {}
    };

    const pick = async () => {
        const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.5, base64: true });
        if (!r.canceled && r.assets?.[0]) setImg({ uri: r.assets[0].uri, b64: r.assets[0].base64 || '' });
    };

    const clear = async () => {
        await AsyncStorage.removeItem('@ek_chat_v4');
        setMsgs([{ id: Date.now().toString(), role: 'assistant', content: 'Conversation cleared. How can I assist you?', ts: Date.now() }]);
    };

    const send = async () => {
        const txt = input.trim();
        if (!txt && !img) return;

        const um: Msg = { id: Date.now().toString(), role: 'user', content: txt, imageUri: img?.uri, imageBase64: img?.b64, ts: Date.now() };
        const upd = [...msgs, um];
        setMsgs(upd);
        setInput('');
        setImg(null);
        setBusy(true);

        try {
            const fm = upd.map(m => {
                if (m.imageBase64) {
                    return { role: m.role, content: [
                        { type: 'text', text: m.content || 'Describe this image.' },
                        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${m.imageBase64}` } },
                    ]};
                }
                return { role: m.role, content: m.content };
            });

            const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                model: MODEL, messages: [SYSTEM_PROMPT, ...fm],
            }, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://eklectic.tn',
                    'X-Title': 'EKLECTIC AI',
                },
                timeout: 30000,
            });

            const raw = res.data?.choices?.[0]?.message?.content;
            const am: Msg = { id: (Date.now() + 1).toString(), role: 'assistant', content: typeof raw === 'string' ? raw : JSON.stringify(raw), ts: Date.now() };
            const fin = [...upd, am];
            setMsgs(fin);
            save(fin);
        } catch (e: any) {
            const em: Msg = { id: (Date.now() + 1).toString(), role: 'assistant', content: e?.response?.data?.error?.message || 'Connection error. Please try again.', ts: Date.now() };
            const fin = [...upd, em];
            setMsgs(fin);
            save(fin);
        } finally { setBusy(false); }
    };

    const canSend = !!(input.trim() || img);

    const renderMsg = ({ item, index }: { item: Msg; index: number }) => {
        const isUser = item.role === 'user';
        const showTime = index === msgs.length - 1 || msgs[index + 1]?.role !== item.role;

        return (
            <View style={[st.msgOuter, isUser ? st.msgOuterUser : st.msgOuterAi]}>
                {!isUser && <Image source={LOGO} style={st.avatar} />}
                <View style={{ maxWidth: SW * 0.72, flexShrink: 1 }}>
                    <View style={[st.bubble, isUser ? st.bubbleUser : st.bubbleAi]}>
                        {item.imageUri && <Image source={{ uri: item.imageUri }} style={st.msgImg} />}
                        {!!item.content && <Text style={[st.msgTxt, isUser ? st.msgTxtUser : st.msgTxtAi]}>{item.content}</Text>}
                    </View>
                    {showTime && <Text style={[st.time, isUser && { textAlign: 'right' }]}>{fmtTime(item.ts)}</Text>}
                </View>
            </View>
        );
    };

    return (
        <View style={st.root}>
            <StatusBar barStyle="light-content" backgroundColor="#1a0a3e" translucent />
            <View style={st.bg}>
                <View style={st.bgGrad1} />
                <View style={st.bgGrad2} />
            </View>
            <SafeAreaView style={{ flex: 1 }}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>

                    <View style={st.header}>
                        <View style={st.headerLeft}>
                            <Image source={LOGO} style={st.headerLogo} />
                            <View>
                                <Text style={st.headerTitle}>EKLECTIC</Text>
                                <View style={st.onlineRow}>
                                    <View style={st.onlineDot} />
                                    <Text style={st.onlineTxt}>GPT-4o Mini</Text>
                                </View>
                            </View>
                        </View>
                        <Pressable onPress={clear} style={({ pressed }) => [st.headerBtn, pressed && { opacity: 0.5 }]}>
                            <View style={st.trashIcon}>
                                <View style={st.trashLid} />
                                <View style={st.trashBody}>
                                    <View style={st.trashLine} />
                                    <View style={st.trashLine} />
                                </View>
                            </View>
                        </Pressable>
                    </View>

                    <FlatList
                        ref={listRef}
                        data={msgs}
                        keyExtractor={i => i.id}
                        renderItem={renderMsg}
                        contentContainerStyle={st.list}
                        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
                        showsVerticalScrollIndicator={false}
                        ListFooterComponent={busy ? <TypingDots /> : null}
                    />

                    <View style={st.bottom}>
                        {img && (
                            <View style={st.prevWrap}>
                                <Image source={{ uri: img.uri }} style={st.prevImg} />
                                <Pressable style={({ pressed }) => [st.prevX, pressed && { opacity: 0.5 }]} onPress={() => setImg(null)}>
                                    <View style={[st.xLine, { transform: [{ rotate: '45deg' }] }]} />
                                    <View style={[st.xLine, { transform: [{ rotate: '-45deg' }] }]} />
                                </Pressable>
                            </View>
                        )}
                        <View style={st.inputRow}>
                            <Pressable onPress={pick} style={({ pressed }) => [st.camBtn, pressed && { opacity: 0.5, transform: [{ scale: 0.92 }] }]}>
                                <View style={st.camBody}>
                                    <View style={st.camLens} />
                                </View>
                                <View style={st.camTop} />
                            </Pressable>

                            <View style={st.inputWrap}>
                                <TextInput
                                    style={st.input}
                                    placeholder="Message..."
                                    placeholderTextColor="rgba(255,255,255,0.3)"
                                    value={input}
                                    onChangeText={setInput}
                                    multiline
                                    maxLength={4000}
                                />
                            </View>

                            <Pressable
                                onPress={send}
                                disabled={!canSend || busy}
                                style={({ pressed }) => [
                                    st.sendBtn,
                                    canSend && st.sendBtnActive,
                                    pressed && canSend && { transform: [{ scale: 0.88 }], opacity: 0.8 },
                                ]}
                            >
                                {busy ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <View style={st.sendArrow}>
                                        <View style={st.arrowHead} />
                                        <View style={st.arrowTail} />
                                    </View>
                                )}
                            </Pressable>
                        </View>
                    </View>

                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const st = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#1a0a3e' },

    bg: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
    bgGrad1: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#1a0a3e' },
    bgGrad2: { position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: 'rgba(200,50,120,0.08)' },

    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: 'rgba(20,8,60,0.85)',
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
        marginTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerLogo: { width: 44, height: 44, borderRadius: 13 },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: 2 },
    onlineRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34d399', marginRight: 5 },
    onlineTxt: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
    headerBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },

    trashIcon: { alignItems: 'center' },
    trashLid: { width: 14, height: 2, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 1, marginBottom: 1 },
    trashBody: { width: 10, height: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 2, borderTopWidth: 0, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 2 },
    trashLine: { width: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.4)' },

    list: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6 },

    msgOuter: { flexDirection: 'row', marginBottom: 8 },
    msgOuterUser: { justifyContent: 'flex-end' },
    msgOuterAi: { justifyContent: 'flex-start' },
    avatar: { width: 30, height: 30, borderRadius: 10, marginRight: 8, marginTop: 2 },

    bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
    bubbleUser: { backgroundColor: '#c026d3', borderBottomRightRadius: 6 },
    bubbleAi: { backgroundColor: 'rgba(255,255,255,0.06)', borderBottomLeftRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },

    msgTxt: { fontSize: 15, lineHeight: 22 },
    msgTxtUser: { color: '#fff' },
    msgTxtAi: { color: 'rgba(255,255,255,0.85)' },
    msgImg: { width: 200, height: 200, borderRadius: 14, marginBottom: 6 },
    time: { fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 3, marginHorizontal: 4 },

    typingRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8 },
    typingAvatar: { width: 30, height: 30, borderRadius: 10, marginRight: 8 },
    typingBubble: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', padding: 14, borderRadius: 20, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },

    bottom: {
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: Platform.OS === 'android' ? 28 : 14,
        backgroundColor: 'rgba(20,8,60,0.9)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end' },

    camBtn: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
    camBody: { width: 20, height: 14, borderRadius: 3, borderWidth: 1.8, borderColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center' },
    camLens: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
    camTop: { width: 8, height: 3, backgroundColor: 'rgba(255,255,255,0.5)', borderTopLeftRadius: 2, borderTopRightRadius: 2, position: 'absolute', top: 12 },

    inputWrap: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, justifyContent: 'center' },
    input: { color: '#fff', fontSize: 15, minHeight: 46, maxHeight: 110, paddingTop: Platform.OS === 'ios' ? 14 : 12, paddingBottom: Platform.OS === 'ios' ? 14 : 12 },

    sendBtn: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
    sendBtnActive: { backgroundColor: '#c026d3' },

    sendArrow: { alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-45deg' }] },
    arrowHead: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#fff' },
    arrowTail: { width: 2.5, height: 8, backgroundColor: '#fff', marginTop: -1 },

    prevWrap: { width: 68, height: 68, borderRadius: 14, overflow: 'hidden', marginBottom: 10 },
    prevImg: { width: '100%', height: '100%' },
    prevX: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
    xLine: { width: 12, height: 2, backgroundColor: '#fff', borderRadius: 1, position: 'absolute' },
});
