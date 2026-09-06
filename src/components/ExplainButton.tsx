import React from 'react';
import { Accordion } from './Accordion';
import { StyleSheet } from 'react-native';

type Props = {
  label?: string;
  title: string;
  body: string;
};

/** תאימות לאחור — פריט אקורדיון יחיד */
export default function ExplainButton({ label, title, body }: Props) {
  return (
    <Accordion
      items={[
        {
          id: title,
          question: label || title,
          answer: body,
        },
      ]}
      style={styles.wrap}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, width: '100%' },
});
