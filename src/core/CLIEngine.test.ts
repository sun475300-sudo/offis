import { describe, it, expect } from 'vitest';
import { CLIEngine } from './CLIEngine';

describe('CLIEngine', () => {
  it('should register and execute a slash command', async () => {
    const cli = new CLIEngine();
    cli.registerCommand({
      name: 'hello',
      aliases: ['hi'],
      description: 'Greet',
      usage: '/hello',
      handler: async () => 'Hello World!',
    });

    const result = await cli.execute('/hello');
    expect(result.output).toBe('Hello World!');
    expect(result.type).toBe('success');
  });

  it('should execute by alias', async () => {
    const cli = new CLIEngine();
    cli.registerCommand({
      name: 'hello',
      aliases: ['hi'],
      description: 'Greet',
      usage: '/hello',
      handler: async () => 'Greetings!',
    });

    const result = await cli.execute('/hi');
    expect(result.output).toBe('Greetings!');
  });

  it('should return error for unknown commands', async () => {
    const cli = new CLIEngine();
    const result = await cli.execute('/unknown');
    expect(result.type).toBe('error');
    expect(result.output).toContain('Unknown command');
  });

  it('should pass arguments to handler', async () => {
    const cli = new CLIEngine();
    let receivedArgs: string[] = [];
    cli.registerCommand({
      name: 'zoom',
      aliases: [],
      description: 'Zoom',
      usage: '/zoom <level>',
      handler: async (args) => { receivedArgs = args; return 'ok'; },
    });

    await cli.execute('/zoom 2.5');
    expect(receivedArgs).toEqual(['2.5']);
  });

  it('should pass through non-slash input as info', async () => {
    const cli = new CLIEngine();
    const result = await cli.execute('just some text');
    expect(result.type).toBe('info');
    expect(result.output).toBe('just some text');
  });

  it('should return empty for blank input', async () => {
    const cli = new CLIEngine();
    const result = await cli.execute('');
    expect(result.output).toBe('');
    expect(result.type).toBe('info');
  });

  it('should handle errors in command handler', async () => {
    const cli = new CLIEngine();
    cli.registerCommand({
      name: 'fail',
      aliases: [],
      description: 'Fail',
      usage: '/fail',
      handler: async () => { throw new Error('boom'); },
    });

    const result = await cli.execute('/fail');
    expect(result.type).toBe('error');
    expect(result.output).toContain('boom');
  });

  it('should provide autocomplete suggestions', () => {
    const cli = new CLIEngine();
    cli.registerCommand({ name: 'help', aliases: [], description: '', usage: '', handler: async () => {} });
    cli.registerCommand({ name: 'hello', aliases: [], description: '', usage: '', handler: async () => {} });
    cli.registerCommand({ name: 'zoom', aliases: [], description: '', usage: '', handler: async () => {} });

    const suggestions = cli.getAutocompleteSuggestions('/hel');
    expect(suggestions).toContain('/help');
    expect(suggestions).toContain('/hello');
    expect(suggestions).not.toContain('/zoom');
  });

  it('should navigate command history', async () => {
    const cli = new CLIEngine();
    await cli.execute('first');
    await cli.execute('second');
    await cli.execute('third');

    expect(cli.historyUp()).toBe('third');
    expect(cli.historyUp()).toBe('second');
    expect(cli.historyUp()).toBe('first');
    expect(cli.historyDown()).toBe('second');
  });

  it('should list registered commands without duplicates', () => {
    const cli = new CLIEngine();
    cli.registerCommand({ name: 'test', aliases: ['t', 'tst'], description: '', usage: '', handler: async () => {} });
    const cmds = cli.getRegisteredCommands();
    expect(cmds.length).toBe(1);
    expect(cmds[0].name).toBe('test');
  });
});
