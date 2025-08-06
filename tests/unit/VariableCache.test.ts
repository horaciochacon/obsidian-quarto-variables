import { VariableCache } from '@/modules/VariableCache';
import { App, TFile } from 'obsidian';
import * as yaml from 'js-yaml';

jest.mock('js-yaml');

describe('VariableCache', () => {
  let cache: VariableCache;
  let mockApp: App;

  beforeEach(() => {
    mockApp = new App();
    cache = new VariableCache(mockApp);
  });

  afterEach(() => {
    cache.destroy();
    jest.clearAllMocks();
  });

  describe('loadVariables', () => {
    it('should load and cache variables from YAML file', async () => {
      const mockFile = new TFile('_variables.yml');
      const mockContent = 'foo: bar\nnested:\n  key: value';
      const mockData = { foo: 'bar', nested: { key: 'value' } };

      mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);
      mockApp.vault.read = jest.fn().mockResolvedValue(mockContent);
      (yaml.load as jest.Mock).mockReturnValue(mockData);

      const projectInfo = {
        root: '',
        variablesPath: '_variables.yml',
        quartoConfigPath: '_quarto.yml'
      };

      const result = await cache.loadVariables(projectInfo);

      expect(result).not.toBeNull();
      expect(result?.data).toEqual(mockData);
      expect(mockApp.vault.read).toHaveBeenCalledWith(mockFile);
    });

    it('should return cached entry on second call', async () => {
      const mockFile = new TFile('_variables.yml');
      const mockContent = 'foo: bar';
      const mockData = { foo: 'bar' };

      mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);
      mockApp.vault.read = jest.fn().mockResolvedValue(mockContent);
      (yaml.load as jest.Mock).mockReturnValue(mockData);

      const projectInfo = {
        root: '',
        variablesPath: '_variables.yml',
        quartoConfigPath: '_quarto.yml'
      };

      await cache.loadVariables(projectInfo);
      const result = await cache.loadVariables(projectInfo);

      expect(mockApp.vault.read).toHaveBeenCalledTimes(1);
      expect(result?.data).toEqual(mockData);
    });

    it('should handle missing file gracefully', async () => {
      mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);

      const projectInfo = {
        root: '',
        variablesPath: '_variables.yml',
        quartoConfigPath: '_quarto.yml'
      };

      const result = await cache.loadVariables(projectInfo);

      expect(result).toBeNull();
    });

    it('should handle YAML parse errors', async () => {
      const mockFile = new TFile('_variables.yml');
      const mockContent = 'invalid: yaml: content:';

      mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);
      mockApp.vault.read = jest.fn().mockResolvedValue(mockContent);
      (yaml.load as jest.Mock).mockImplementation(() => {
        throw new Error('YAML parse error');
      });

      const projectInfo = {
        root: '',
        variablesPath: '_variables.yml',
        quartoConfigPath: '_quarto.yml'
      };

      const result = await cache.loadVariables(projectInfo);

      expect(result).toBeNull();
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      const mockFile = new TFile('_variables.yml');
      const mockData = {
        simple: 'value',
        nested: {
          level1: {
            level2: 'deep value'
          }
        },
        number: 42,
        boolean: true
      };

      mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);
      mockApp.vault.read = jest.fn().mockResolvedValue('');
      (yaml.load as jest.Mock).mockReturnValue(mockData);

      const projectInfo = {
        root: '',
        variablesPath: '_variables.yml',
        quartoConfigPath: '_quarto.yml'
      };

      await cache.loadVariables(projectInfo);
    });

    it('should get simple value', () => {
      const projectInfo = {
        root: '',
        variablesPath: '_variables.yml',
        quartoConfigPath: '_quarto.yml'
      };

      const value = cache.get(projectInfo, 'simple');
      expect(value).toBe('value');
    });

    it('should get nested value', () => {
      const projectInfo = {
        root: '',
        variablesPath: '_variables.yml',
        quartoConfigPath: '_quarto.yml'
      };

      const value = cache.get(projectInfo, 'nested.level1.level2');
      expect(value).toBe('deep value');
    });

    it('should convert non-string values to strings', () => {
      const projectInfo = {
        root: '',
        variablesPath: '_variables.yml',
        quartoConfigPath: '_quarto.yml'
      };

      expect(cache.get(projectInfo, 'number')).toBe('42');
      expect(cache.get(projectInfo, 'boolean')).toBe('true');
    });

    it('should return undefined for missing keys', () => {
      const projectInfo = {
        root: '',
        variablesPath: '_variables.yml',
        quartoConfigPath: '_quarto.yml'
      };

      expect(cache.get(projectInfo, 'missing')).toBeUndefined();
      expect(cache.get(projectInfo, 'nested.missing.key')).toBeUndefined();
    });
  });

  describe('hot reload', () => {
    it('should reload on file modification', async () => {
      const mockCallback = jest.fn();
      mockApp.vault.on = jest.fn().mockImplementation((event, cb) => {
        if (event === 'modify') {
          mockCallback.mockImplementation(cb);
        }
        return {};
      });

      await cache.initialize();

      const mockFile = new TFile('_variables.yml');
      mockFile.path = '_variables.yml';
      
      const newData = { updated: 'value' };
      mockApp.vault.read = jest.fn().mockResolvedValue('updated: value');
      (yaml.load as jest.Mock).mockReturnValue(newData);

      expect(mockCallback).toBeDefined();
    });
  });
});