"""
High-Accuracy Devanagari to Romanized Hinglish Transliterator & Language Processor.
Translates spoken Hindi / Hinglish recognized in Devanagari into natural Latin-alphabet Hinglish.
Designed specifically for Indian creators (Reels, Shorts, YouTube, TikTok).
"""
import re

# Comprehensive dictionary of high-frequency spoken Hindi / Hinglish words
# mapped to standard phonetic social-media romanization.
COMMON_WORDS = {
    # Pronouns & determiners
    'मैं': 'main', 'मुझे': 'mujhe', 'मुझको': 'mujhko', 'मेरा': 'mera', 'मेरी': 'meri', 'मेरे': 'mere',
    'हम': 'hum', 'हमे': 'humein', 'हमें': 'humein', 'हमको': 'humko', 'हमारा': 'hamara', 'हमारी': 'hamari', 'हमारे': 'hamare',
    'तू': 'tu', 'तुझे': 'tujhe', 'तेरा': 'tera', 'तेरी': 'teri', 'तेरे': 'tere',
    'तुम': 'tum', 'तुम्हें': 'tumhein', 'तुमको': 'tumko', 'तुम्हारा': 'tumhara', 'तुम्हारी': 'tumhari', 'तुम्हारे': 'tumhare',
    'आप': 'aap', 'आपको': 'aapko', 'आपका': 'aapka', 'आपकी': 'aapki', 'आपके': 'aapke',
    'यह': 'yeh', 'ये': 'yeh', 'वह': 'woh', 'वो': 'woh',
    'इस': 'is', 'इसे': 'ise', 'इसको': 'isko', 'इसका': 'iska', 'इसकी': 'iski', 'इसके': 'iske',
    'उस': 'us', 'उसे': 'use', 'उसको': 'usko', 'उसका': 'uska', 'उसकी': 'uski', 'उसके': 'uske',
    'इन': 'in', 'इन्हें': 'inhein', 'इनको': 'inko', 'इनका': 'inka', 'इनकी': 'inki', 'इनके': 'inke',
    'उन': 'un', 'उन्हें': 'unhein', 'उनको': 'unko', 'उनका': 'unka', 'उनकी': 'unki', 'उनके': 'unke',
    'अपना': 'apna', 'अपनी': 'apni', 'अपने': 'apne', 'आपस': 'aapas',

    # Question words
    'क्या': 'kya', 'क्यों': 'kyun', 'कैसे': 'kaise', 'कैसा': 'kaisa', 'कैसी': 'kaisi', 'कैसे': 'kaise',
    'कब': 'kab', 'कहाँ': 'kahan', 'कहा': 'kaha', 'किधर': 'kidhar',
    'कौन': 'kaun', 'किसे': 'kise', 'किसको': 'kisko', 'किसका': 'kiska', 'किसकी': 'kiski', 'किसके': 'kiske',
    'कितना': 'kitna', 'कितनी': 'kitni', 'कितने': 'kitne',

    # Conjunctions & prepositions
    'और': 'aur', 'या': 'ya', 'तो': 'toh', 'भी': 'bhi', 'ही': 'hi', 'तक': 'tak',
    'से': 'se', 'को': 'ko', 'का': 'ka', 'की': 'ki', 'के': 'ke', 'में': 'mein', 'पर': 'par', 'पे': 'pe',
    'ने': 'ne', 'लिए': 'liye', 'बारे': 'baare', 'साथ': 'saath', 'बिना': 'bina',
    'अगर': 'agar', 'यदि': 'yadi', 'लेकिन': 'lekin', 'मगर': 'magar', 'परन्तु': 'parantu',
    'क्योंकि': 'kyunki', 'इसलिए': 'isliye', 'ताकि': 'taaki', 'कि': 'ki',

    # Negation & affirmations
    'नहीं': 'nahi', 'ना': 'na', 'मत': 'mat', 'हाँ': 'haan', 'हा': 'haan', 'ज़रूर': 'zaroor', 'जरूर': 'zaroor',

    # Auxiliary & common verbs (be / have / state)
    'है': 'hai', 'हैं': 'hain', 'हो': 'ho', 'हूं': 'hoon', 'हूँ': 'hoon',
    'था': 'tha', 'थी': 'thi', 'थे': 'the',
    'होना': 'hona', 'होता': 'hota', 'होती': 'hoti', 'होते': 'hote',
    'होगा': 'hoga', 'होगी': 'hogi', 'होंगे': 'honge', 'हुए': 'huye', 'हुआ': 'hua', 'हुई': 'hui',
    'रहा': 'raha', 'रही': 'rahi', 'रहे': 'rahe',

    # Action verbs
    'करना': 'karna', 'कर': 'kar', 'करो': 'karo', 'करे': 'kare', 'करें': 'karein',
    'करते': 'karte', 'करती': 'karti', 'करेंगे': 'karenge', 'करूँगा': 'karunga', 'करूंगा': 'karunga',
    'किया': 'kiya', 'कीजिए': 'kijiye', 'करके': 'karke',
    'सकते': 'sakte', 'सकता': 'sakta', 'सकती': 'sakti', 'सकेंगे': 'sakenge',
    'जाना': 'jaana', 'जा': 'jaa', 'जाओ': 'jao', 'जाए': 'jaaye', 'जाएं': 'jaayein',
    'जाते': 'jaate', 'जाती': 'jaati', 'जाएंगे': 'jaayenge', 'गया': 'gaya', 'गई': 'gayi', 'गए': 'gaye',
    'आना': 'aana', 'आ': 'aa', 'आओ': 'aao', 'आए': 'aaye', 'आएं': 'aayein',
    'आते': 'aate', 'आती': 'aati', 'आएंगे': 'aayenge', 'आया': 'aaya', 'आई': 'aayi',
    'देख': 'dekh', 'देखो': 'dekho', 'देखें': 'dekhein', 'देखना': 'dekhna', 'देखा': 'dekha', 'देखी': 'dekhi', 'देखे': 'dekhe',
    'सुन': 'sun', 'सुनो': 'suno', 'सुनना': 'sunna', 'सुना': 'suna',
    'बोल': 'bol', 'बोलो': 'bolo', 'बोलना': 'bolna', 'बोला': 'bola',
    'बताना': 'batana', 'बता': 'bata', 'बताओ': 'batao', 'बताएं': 'batayein', 'बताया': 'bataya',
    'कहना': 'kehna', 'कहो': 'kaho', 'कहा': 'kaha', 'कहते': 'kehte',
    'देना': 'dena', 'दे': 'de', 'दो': 'do', 'दें': 'dein', 'दिया': 'diya', 'दिए': 'diye', 'दी': 'di', 'दीजिए': 'dijiye',
    'लेना': 'lena', 'ले': 'le', 'लो': 'lo', 'लें': 'lein', 'लिया': 'liya', 'लिए': 'liye', 'ली': 'li', 'लीजिए': 'lijiye',
    'मिलना': 'milna', 'मिल': 'mil', 'मिला': 'mila', 'मिले': 'mile', 'मिलते': 'milte', 'मिलेगा': 'milega', 'मिलेगी': 'milegi',
    'चाहिए': 'chahiye', 'चाहते': 'chahte', 'चाहता': 'chahta', 'चाहती': 'chahti',
    'लगता': 'lagta', 'लगती': 'lagti', 'लगते': 'lagte', 'लगा': 'laga', 'लगी': 'lagi', 'लगे': 'lage',
    'सोच': 'soch', 'सोचो': 'socho', 'समझा': 'samjha', 'समझ': 'samajh', 'समझो': 'samjho',
    'रखना': 'rakhna', 'रखो': 'rakho', 'रखा': 'rakha',

    # Time & location adverbs
    'आज': 'aaj', 'कल': 'kal', 'परसों': 'parson', 'अब': 'ab', 'अभी': 'abhi', 'तब': 'tab',
    'कभी': 'kabhi', 'हमेशा': 'hamesha', 'पहले': 'pehle', 'बाद': 'baad',
    'यहाँ': 'yahan', 'यहां': 'yahan', 'वहाँ': 'wahan', 'वहां': 'wahan',
    'अंदर': 'andar', 'बाहर': 'bahar', 'ऊपर': 'upar', 'नीचे': 'neeche',
    'आगे': 'aage', 'पीछे': 'peeche', 'सामने': 'saamne', 'पास': 'paas', 'दूर': 'door',

    # Quantifiers & adjectives
    'बहुत': 'bahut', 'ज्यादा': 'zyada', 'ज़्यादा': 'zyada', 'कम': 'kam',
    'थोड़ा': 'thoda', 'थोड़ी': 'thodi', 'थोड़े': 'thode',
    'अच्छा': 'achha', 'अच्छी': 'achhi', 'अच्छे': 'achhe',
    'बढ़िया': 'badhiya', 'सही': 'sahi', 'गलत': 'galat',
    'पूरा': 'poora', 'पूरी': 'poori', 'पूरे': 'poore',
    'सारा': 'saara', 'सारी': 'saari', 'सारे': 'saare',
    'कुछ': 'kuch', 'कोई': 'koi', 'सब': 'sab', 'सभी': 'sabhi', 'हर': 'har',
    'एक': 'ek', 'दो': 'do', 'तीन': 'teen', 'चार': 'chaar', 'पांच': 'paanch',
    'पहला': 'pehla', 'पहली': 'pehli', 'पहले': 'pehle',
    'नया': 'naya', 'नयी': 'nayi', 'नए': 'naye', 'पुराना': 'purana',

    # Creator, social media & tech terms
    'दोस्तों': 'dosto', 'दोस्त': 'dost', 'भाई': 'bhai', 'यार': 'yaar', 'लोग': 'log', 'लोगों': 'logon',
    'वीडियो': 'video', 'विडियो': 'video', 'चैनल': 'channel',
    'सब्सक्राइब': 'subscribe', 'लाइक': 'like', 'शेयर': 'share', 'फॉलो': 'follow', 'कमेंट': 'comment',
    'फोन': 'phone', 'फ़ोन': 'phone', 'मोबाइल': 'mobile',
    'एडिटिंग': 'editing', 'एडिट': 'edit', 'कैप्शन': 'caption', 'कैप्शन्स': 'captions',
    'ट्रिक': 'trick', 'टिप्स': 'tips', 'ट्रिक्स': 'tricks', 'फीचर': 'feature',
    'लिंक': 'link', 'डिस्क्रिप्शन': 'description', 'स्क्रीन': 'screen', 'फोटो': 'photo',
    'ऑप्शन': 'option', 'ऑप्शंस': 'options', 'सेटिंग्स': 'settings', 'सेटिंग': 'setting',
    'बात': 'baat', 'काम': 'kaam', 'नाम': 'naam', 'दिन': 'din', 'साल': 'saal', 'समय': 'samay', 'टाइम': 'time',
    'तरह': 'tarah', 'जगह': 'jagah', 'तरीका': 'tareeka', 'तरीके': 'tareeke',
    'कमाल': 'kamaal', 'वायरल': 'viral', 'क्रेजी': 'crazy', 'सुपर': 'super', 'बेस्ट': 'best',
    'चला': 'chala', 'चले': 'chale', 'चली': 'chali', 'चल': 'chal', 'चलना': 'chalna', 'चलाना': 'chalana',
    'बड़ा': 'bada', 'बड़ी': 'badi', 'बड़े': 'bade',
    'छोटा': 'chhota', 'छोटी': 'chhoti', 'छोटे': 'chhote',
    'लगा': 'laga', 'लगी': 'lagi', 'लगे': 'lage',
    'पता': 'pata', 'हवा': 'hawa', 'दवा': 'dawa',
    'दिखा': 'dikha', 'दिखाया': 'dikhaya', 'दिखे': 'dikhe', 'दिखना': 'dikhna',
    'सिखा': 'sikha', 'सिखाया': 'sikhaya', 'सीख': 'seekh', 'सीखो': 'seekho',
    'बना': 'bana', 'बनाओ': 'banao', 'बनाया': 'banaya', 'बनाना': 'banana', 'बनाने': 'banane',
    'बता': 'bata', 'बताओ': 'batao', 'बताया': 'bataya', 'बताना': 'batana',
    'रखा': 'rakha', 'रखो': 'rakho', 'रखना': 'rakhna',
    'शुरू': 'shuru', 'खत्म': 'khatam', 'वापस': 'wapas',
    'वाला': 'wala', 'वाली': 'wali', 'वाले': 'wale',
    'ऐसा': 'aisa', 'ऐसी': 'aisi', 'ऐसे': 'aise',
    'वैसा': 'waisa', 'वैसी': 'waisi', 'वैसे': 'waise',
    'खुद': 'khud', 'सबको': 'sabko', 'सबके': 'sabke',
    'क्लिक': 'click', 'बटन': 'button', 'डाउनलोड': 'download',
    'ऑडियो': 'audio', 'साउंड': 'sound', 'इफेक्ट': 'effect', 'इफेक्ट्स': 'effects',
    'टेम्पलेट': 'template', 'फॉन्ट': 'font', 'स्टाइल': 'style'
}

# Phonetic character tables
VOWELS = {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
    'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
    'ऑ': 'o', 'ऍ': 'e'
}

MATRAS = {
    'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
    'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
    'ॉ': 'o', 'ॅ': 'e'
}

CONSONANTS = {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
    'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
    'क्ष': 'ksh', 'त्र': 'tr', 'ज्ञ': 'gya', 'श्र': 'shr',
    'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'd', 'ढ़': 'dh', 'फ़': 'f',
    '\u0958': 'q', '\u0959': 'kh', '\u095a': 'gh', '\u095b': 'z', '\u095c': 'd', '\u095d': 'dh', '\u095e': 'f'
}

HALANT = '्'
ANUSVARA = 'ं'
CHANDRABINDU = 'ँ'
VISARGA = 'ः'
NUKTA = '़'

DEVANAGARI_RE = re.compile(r'[\u0900-\u097F]')


def is_devanagari(text):
    """Check if string contains any Devanagari characters."""
    return bool(DEVANAGARI_RE.search(text))


def phonetic_word_to_hinglish(word):
    """Phonetically transliterates a Devanagari word with Hindi schwa deletion."""
    # Pre-normalize nukta character combinations to single canonical forms
    word = (word.replace('क' + NUKTA, '\u0958')
                .replace('ख' + NUKTA, '\u0959')
                .replace('ग' + NUKTA, '\u095a')
                .replace('ज' + NUKTA, '\u095b')
                .replace('ड' + NUKTA, '\u095c')
                .replace('ढ' + NUKTA, '\u095d')
                .replace('फ' + NUKTA, '\u095e')
                .replace('क़', '\u0958')
                .replace('ख़', '\u0959')
                .replace('ग़', '\u095a')
                .replace('ज़', '\u095b')
                .replace('ड़', '\u095c')
                .replace('ढ़', '\u095d')
                .replace('फ़', '\u095e'))
    # Clean any remaining stray nukta codepoints
    word = word.replace(NUKTA, '')

    chars = list(word)
    n = len(chars)
    out = []
    i = 0
    while i < n:
        c = chars[i]
        next_c = chars[i + 1] if i + 1 < n else ''

        if c in VOWELS:
            out.append(VOWELS[c])
            i += 1
        elif c in CONSONANTS:
            base = CONSONANTS[c]
            out.append(base)
            if next_c in MATRAS:
                out.append(MATRAS[next_c])
                i += 2
            elif next_c == HALANT:
                i += 2  # halant suppresses inherent 'a'
            elif next_c in (ANUSVARA, CHANDRABINDU):
                out.append('an')
                i += 2
            elif next_c == VISARGA:
                out.append('ah')
                i += 2
            else:
                # Schwa deletion:
                # 1. At word boundary (terminal consonant), modern Hindi drops inherent 'a' (e.g. kam, kar, bol).
                # 2. At initial consonant (i == 0), inherent 'a' is ALWAYS preserved before another consonant!
                #    e.g. 'चला' -> chala, 'लगा' -> laga, 'बड़ा' -> bada, 'पता' -> pata, 'नया' -> naya.
                # 3. For medial consonants (i > 0) when followed by a consonant + matra (syllable boundary),
                #    schwa is deleted (e.g. 'करता' -> k-a-r-t-a, 'लगता' -> l-a-g-t-a, 'सकता' -> s-a-k-t-a).
                is_last = (i == n - 1)
                if not is_last and next_c in CONSONANTS:
                    next2_c = chars[i + 2] if i + 2 < n else ''
                    if next2_c == HALANT:
                        out.append('a')
                    elif next2_c in MATRAS:
                        if i == 0:
                            out.append('a')  # Initial consonant always keeps inherent 'a'
                        else:
                            pass  # Medial schwa deletion before matra
                    else:
                        out.append('a')
                i += 1
        elif c in MATRAS:
            out.append(MATRAS[c])
            i += 1
        elif c in (ANUSVARA, CHANDRABINDU):
            out.append('n')
            i += 1
        elif c == VISARGA:
            out.append('h')
            i += 1
        else:
            out.append(c)
            i += 1
    return ''.join(out)


def convert_token(token):
    """Convert a single token (which might have leading/trailing punctuation)."""
    # Separate leading punctuation
    lead_m = re.match(r'^([^\w\u0900-\u097F]+)', token)
    lead = lead_m.group(1) if lead_m else ''
    token = token[len(lead):]

    # Separate trailing punctuation
    trail_m = re.search(r'([^\w\u0900-\u097F]+)$', token)
    trail = trail_m.group(1) if trail_m else ''
    if trail:
        token = token[:-len(trail)]

    if not token:
        return lead + trail

    # If it has no Devanagari, keep as is (e.g. English words, numbers)
    if not is_devanagari(token):
        return lead + token + trail

    # Check common words dictionary
    cleaned = re.sub(r'[\u0964\u0965]', '', token)  # remove danda
    if cleaned in COMMON_WORDS:
        translated = COMMON_WORDS[cleaned]
    else:
        translated = phonetic_word_to_hinglish(cleaned)

    return lead + translated + trail


def devanagari_to_hinglish(text):
    """
    Convert full text containing Devanagari Hindi to natural Romanized Hinglish.
    Preserves English words, numbers, and punctuation.
    """
    if not text or not is_devanagari(text):
        return text

    # Split into lines/tokens
    lines = text.split('\n')
    out_lines = []
    for line in lines:
        tokens = line.split(' ')
        converted = [convert_token(t) for t in tokens]
        out_lines.append(' '.join(converted))

    res = '\n'.join(out_lines)
    # Post-cleanup: clean double spaces, Hindi danda (|) to period
    res = res.replace('।', '.').replace('॥', '.')
    return res
