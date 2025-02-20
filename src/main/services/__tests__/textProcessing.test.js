const {
  autoPunctuate,
  filterFillerWords,
  handleSelfCorrections,
  insertParagraphBreaks,
  processText,
} = require('../textProcessing');

describe('Text Processing', () => {
  describe('autoPunctuate', () => {
    it('handles empty input', () => {
      expect(autoPunctuate('')).toBe('');
      expect(autoPunctuate(null)).toBe('');
      expect(autoPunctuate(undefined)).toBe('');
    });

    it('adds periods to sentences without punctuation', () => {
      expect(autoPunctuate('hello world')).toBe('hello world.');
      expect(autoPunctuate('one two three')).toBe('one two three.');
    });

    it('preserves existing punctuation', () => {
      expect(autoPunctuate('hello world!')).toBe('hello world!');
      expect(autoPunctuate('is this a question?')).toBe('is this a question?');
    });

    it('prevents double periods', () => {
      expect(autoPunctuate('hello world..')).toBe('hello world.');
      expect(autoPunctuate('test... more test')).toBe('test. more test.');
    });

    it('handles multiple sentences', () => {
      expect(autoPunctuate('one. two three')).toBe('one. two three.');
      expect(autoPunctuate('hello! how are you')).toBe('hello! how are you.');
    });

    it('cleans up spaces around punctuation', () => {
      expect(autoPunctuate('hello . world')).toBe('hello. world.');
      expect(autoPunctuate('test  .')).toBe('test.');
    });
  });

  describe('filterFillerWords', () => {
    it('removes common filler words', () => {
      const input = 'Um, like, this is uh really good you know';
      const expected = 'this is really good';
      expect(filterFillerWords(input)).toBe(expected);
    });

    it('preserves words that contain filler words', () => {
      const input = 'The umbrella and likelihood are important';
      const expected = 'The umbrella and likelihood are important';
      expect(filterFillerWords(input)).toBe(expected);
    });

    it('handles multiple occurrences of the same filler', () => {
      const input = 'um um um hello um there um';
      const expected = 'hello there';
      expect(filterFillerWords(input)).toBe(expected);
    });

    it('handles empty or null input', () => {
      expect(filterFillerWords('')).toBe('');
      expect(filterFillerWords(null)).toBe('');
    });
  });

  describe('handleSelfCorrections', () => {
    it('handles "I mean" corrections', () => {
      const input = 'three, I mean four cups of sugar';
      const expected = 'four cups of sugar';
      expect(handleSelfCorrections(input)).toBe(expected);
    });

    it('handles "actually" corrections', () => {
      const input = 'take the blue, actually red pill';
      const expected = 'red pill';
      expect(handleSelfCorrections(input)).toBe(expected);
    });

    it('handles "no, I meant" corrections', () => {
      const input = 'wait, no I meant chocolate';
      const expected = 'chocolate';
      expect(handleSelfCorrections(input)).toBe(expected);
    });

    it('handles "or" corrections', () => {
      const input = 'meet at five or make that six';
      const expected = 'six';
      expect(handleSelfCorrections(input)).toBe(expected);
    });

    it('handles empty or null input', () => {
      expect(handleSelfCorrections('')).toBe('');
      expect(handleSelfCorrections(null)).toBe('');
    });
  });

  describe('insertParagraphBreaks', () => {
    it('adds breaks after multiple sentences', () => {
      const input = 'First sentence. Second sentence. Moving on. New topic here.';
      const expected = 'First sentence. Second sentence.\n\nMoving on.\n\nNew topic here.';
      expect(insertParagraphBreaks(input)).toBe(expected);
    });

    it('adds breaks for transition phrases', () => {
      const input = 'This is one topic. However, this is another. Furthermore, a third point.';
      const expected = 'This is one topic.\n\nHowever, this is another.\n\nFurthermore, a third point.';
      expect(insertParagraphBreaks(input)).toBe(expected);
    });

    it('prevents excessive line breaks', () => {
      const input = 'One.\n\n\n\nTwo.\n\n\nThree.';
      const expected = 'One.\n\nTwo.\n\nThree.';
      expect(insertParagraphBreaks(input)).toBe(expected);
    });

    it('handles empty or null input', () => {
      expect(insertParagraphBreaks('')).toBe('');
      expect(insertParagraphBreaks(null)).toBe('');
    });
  });

  describe('processText', () => {
    it('applies all transformations in correct order', () => {
      const input = 'um like hello  there I mean hi  Moving on um this is uh another point';
      const expected = 'Hi.\n\nMoving on, this is another point.';
      expect(processText(input)).toBe(expected);
    });

    it('handles complex text with multiple transformations', () => {
      const input = 'uh first point you know  actually second point However um third point';
      const expected = 'Second point.\n\nHowever, third point.';
      expect(processText(input)).toBe(expected);
    });

    it('handles empty or null input', () => {
      expect(processText('')).toBe('');
      expect(processText(null)).toBe('');
    });
  });

  describe('processText integration', () => {
    it('properly processes text with existing punctuation', () => {
      const input = 'hello world.. this is a test.. final sentence';
      const expected = 'hello world. this is a test. final sentence.';
      expect(processText(input)).toBe(expected);
    });

    it('handles mixed punctuation cases', () => {
      const input = 'is this working? yes it is.. great!.. done';
      const expected = 'is this working? yes it is. great! done.';
      expect(processText(input)).toBe(expected);
    });
  });
}); 