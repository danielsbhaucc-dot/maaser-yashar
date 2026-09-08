import React, { useMemo } from 'react';
import { View, Text, StyleSheet, type TextStyle } from 'react-native';
import { colors, fonts, type } from '../theme';

type Tone = 'bot' | 'me';

type InlineSeg = { text: string; bold?: boolean };

type Block =
  | { type: 'para'; segs: InlineSeg[] }
  | { type: 'ol'; items: InlineSeg[][] }
  | { type: 'ul'; items: InlineSeg[][] };

const MARKER_COLORS = [
  colors.primary,
  colors.accent2,
  colors.gold,
  colors.income,
  colors.accent3,
  colors.badgePink,
] as const;

/** מפצל **הדגשה** לסקגמנטים */
export function parseInlineBold(text: string): InlineSeg[] {
  const segs: InlineSeg[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      segs.push({ text: text.slice(last, m.index) });
    }
    segs.push({ text: m[1]!, bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push({ text: text.slice(last) });
  if (segs.length === 0) segs.push({ text });
  return segs;
}

function isOlLine(line: string): RegExpMatchArray | null {
  return line.match(/^\s*(\d+)[.)]\s+(.+)$/);
}

function isUlLine(line: string): RegExpMatchArray | null {
  return line.match(/^\s*[-•*]\s+(.+)$/);
}

/** מפרסר טקסט קל: פסקאות, רשימות ממוספרות/תבליטים, והדגשת ** */
export function parseMessageBlocks(raw: string): Block[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const ol = isOlLine(line);
    if (ol) {
      const items: InlineSeg[][] = [];
      while (i < lines.length) {
        const cur = lines[i]!;
        if (!cur.trim()) break;
        const m = isOlLine(cur);
        if (!m) break;
        items.push(parseInlineBold(m[2]!));
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    const ul = isUlLine(line);
    if (ul) {
      const items: InlineSeg[][] = [];
      while (i < lines.length) {
        const cur = lines[i]!;
        if (!cur.trim()) break;
        const m = isUlLine(cur);
        if (!m) break;
        items.push(parseInlineBold(m[1]!));
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i]!;
      if (!cur.trim()) break;
      if (isOlLine(cur) || isUlLine(cur)) break;
      paraLines.push(cur);
      i += 1;
    }
    blocks.push({ type: 'para', segs: parseInlineBold(paraLines.join('\n')) });
  }

  return blocks;
}

function InlineText({
  segs,
  baseStyle,
  boldStyle,
}: {
  segs: InlineSeg[];
  baseStyle: TextStyle;
  boldStyle: TextStyle;
}) {
  return (
    <Text style={baseStyle}>
      {segs.map((s, idx) =>
        s.bold ? (
          <Text key={idx} style={boldStyle}>
            {s.text}
          </Text>
        ) : (
          <Text key={idx}>{s.text}</Text>
        )
      )}
    </Text>
  );
}

/**
 * מציג הודעת צ'אט עם הדגשה מעוצבת (בלי כוכביות גולמיות)
 * ורשימות ממוספרות עם עיגולים צבעוניים.
 */
export function RichMessageText({
  content,
  tone = 'bot',
  style,
}: {
  content: string;
  tone?: Tone;
  style?: TextStyle;
}) {
  const blocks = useMemo(() => parseMessageBlocks(content), [content]);
  const isMe = tone === 'me';
  const baseStyle: TextStyle = {
    ...styles.base,
    color: isMe ? colors.chatMeText : colors.ink,
    ...style,
  };
  const boldStyle: TextStyle = {
    fontFamily: fonts.bold,
    color: isMe ? colors.chatMeText : colors.gold,
  };

  return (
    <View style={styles.wrap}>
      {blocks.map((b, bi) => {
        if (b.type === 'para') {
          return (
            <View key={bi} style={styles.para}>
              <InlineText segs={b.segs} baseStyle={baseStyle} boldStyle={boldStyle} />
            </View>
          );
        }

        if (b.type === 'ol') {
          return (
            <View key={bi} style={styles.list}>
              {b.items.map((item, ii) => {
                const color = MARKER_COLORS[ii % MARKER_COLORS.length]!;
                return (
                  <View key={ii} style={styles.listRow}>
                    <View style={[styles.numCircle, { backgroundColor: color }]}>
                      <Text style={styles.numTxt}>{ii + 1}</Text>
                    </View>
                    <View style={styles.listBody}>
                      <InlineText segs={item} baseStyle={baseStyle} boldStyle={boldStyle} />
                    </View>
                  </View>
                );
              })}
            </View>
          );
        }

        return (
          <View key={bi} style={styles.list}>
            {b.items.map((item, ii) => {
              const color = MARKER_COLORS[ii % MARKER_COLORS.length]!;
              return (
                <View key={ii} style={styles.listRow}>
                  <View style={[styles.bulletDot, { backgroundColor: color }]} />
                  <View style={styles.listBody}>
                    <InlineText segs={item} baseStyle={baseStyle} boldStyle={boldStyle} />
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  para: {},
  base: {
    ...type.chat,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  list: {
    gap: 8,
    marginTop: 2,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  numCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  numTxt: {
    color: colors.primaryOn,
    fontSize: 12,
    fontFamily: fonts.bold,
    lineHeight: 14,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 7,
    marginHorizontal: 7,
    flexShrink: 0,
  },
  listBody: {
    flex: 1,
    minWidth: 0,
    paddingTop: 1,
  },
});
