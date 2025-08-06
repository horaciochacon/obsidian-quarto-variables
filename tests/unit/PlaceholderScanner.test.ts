import { PlaceholderScanner } from '@/modules/PlaceholderScanner';
import { EditorView } from '@codemirror/view';

describe('PlaceholderScanner', () => {
  let scanner: PlaceholderScanner;

  beforeEach(() => {
    scanner = new PlaceholderScanner();
  });

  describe('findAll', () => {
    it('should find single variable', () => {
      const text = 'The value is {{<var foo>}}.';
      const matches = scanner.findAll(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({
        from: 13,
        to: 26,
        key: 'foo'
      });
    });

    it('should find multiple variables', () => {
      const text = '{{<var first>}} and {{<var second>}}';
      const matches = scanner.findAll(text);
      
      expect(matches).toHaveLength(2);
      expect(matches[0].key).toBe('first');
      expect(matches[1].key).toBe('second');
    });

    it('should find nested path variables', () => {
      const text = '{{<var config.database.host>}}';
      const matches = scanner.findAll(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].key).toBe('config.database.host');
    });

    it('should handle whitespace variations', () => {
      const variations = [
        '{{<var foo>}}',
        '{{ <var foo> }}',
        '{{< var foo >}}',
        '{{ < var foo > }}'
      ];
      
      variations.forEach(text => {
        const matches = scanner.findAll(text);
        expect(matches).toHaveLength(1);
        expect(matches[0].key).toBe('foo');
      });
    });

    it('should not match invalid patterns', () => {
      const invalidPatterns = [
        '{{var foo}}',
        '{{<var>}}',
        '{{<var foo',
        'var foo>}}',
        '{{<var foo bar>}}'
      ];
      
      invalidPatterns.forEach(text => {
        const matches = scanner.findAll(text);
        expect(matches).toHaveLength(0);
      });
    });
  });

  describe('matchAt', () => {
    it('should find match at position', () => {
      const text = 'Text {{<var foo>}} more text';
      const match = scanner.matchAt(text, 10);
      
      expect(match).not.toBeNull();
      expect(match?.key).toBe('foo');
    });

    it('should return null when no match at position', () => {
      const text = 'Text {{<var foo>}} more text';
      const match = scanner.matchAt(text, 0);
      
      expect(match).toBeNull();
    });
  });

  describe('isValidKey', () => {
    it('should validate correct keys', () => {
      const validKeys = [
        'foo',
        'foo_bar',
        'foo.bar',
        'foo.bar.baz',
        'foo123',
        'a.b.c.d.e'
      ];
      
      validKeys.forEach(key => {
        expect(PlaceholderScanner.isValidKey(key)).toBe(true);
      });
    });

    it('should reject invalid keys', () => {
      const invalidKeys = [
        '',
        'foo bar',
        'foo-bar',
        'foo@bar',
        'foo#bar',
        '.foo',
        'foo.',
        'foo..bar'
      ];
      
      invalidKeys.forEach(key => {
        expect(PlaceholderScanner.isValidKey(key)).toBe(false);
      });
    });
  });
});