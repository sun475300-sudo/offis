import { EventType, AgentState, IEventBus } from '../types';
import { AgentManager } from '../agent/AgentManager';
import { HUDManager } from '../ui/HUDManager';
import { SoundManager } from './SoundManager';
import { ToastManager } from './ToastManager';
import { ChatSystem } from './ChatSystem';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { TaskProgressRenderer } from '../rendering/TaskProgressRenderer';

export function setupAllEventHandlers(
  eventBus: IEventBus,
  agentManager: AgentManager,
  hud: HUDManager,
  sound: SoundManager,
  toast: ToastManager,
  chat: ChatSystem,
  particle: ParticleSystem,
  taskProgress: TaskProgressRenderer,
  runDebateWithVisualization?: (sessionId: string) => Promise<void>
): void {
  
  eventBus.on(EventType.CommandReceived, (event) => {
    const { prompt } = event.payload as { prompt: string };
    if (prompt.startsWith('/github')) {
      hud.logGitHub(`Starting workflow: ${prompt}`);
    } else {
      hud.logUser(prompt);
    }
  });

  eventBus.on(EventType.TasksParsed, (event) => {
    const { tasks } = event.payload as { tasks: any[] };
    hud.logSystem(`Parsed ${tasks.length} tasks`, 'system');
  });

  eventBus.on(EventType.TaskAssigned, (event) => {
    const { agentId, taskDescription, taskId } = event.payload as { agentId: string; taskDescription: string; taskId?: string };
    const agent = agentManager.getAgent(agentId);
    if (agent) {
      const snap = agent.getSnapshot();
      hud.logSystem(`Assigned to ${agent.name}: "${taskDescription.substring(0, 30)}..."`, 'success');
      sound.playTaskAssigned();
      toast.info('Task Assigned', `${agent.name}: ${taskDescription.substring(0, 40)}`, 3000);
      chat.sendSystemMessage(`${agent.name}(${snap.role})에게 "${taskDescription.substring(0, 40)}" 작업 할당됨`);
      
      if (taskId) {
        taskProgress.addProgress(taskId, agentId, taskDescription.substring(0, 20), snap.position);
      }
    }
  });

  eventBus.on(EventType.AgentStateChanged, (event) => {
    const { agentId, newState } = event.payload as { agentId: string; newState: AgentState };
    const agent = agentManager.getAgent(agentId);
    if (agent && newState === AgentState.Working) {
      chat.sendMessage(agentId, agent.name, agent.role, '작업 시작합니다!');
    }
  });

  eventBus.on(EventType.AgentTalked, (event) => {
    const { message } = event.payload as { message: string };
    hud.logGitHub(`에이전트 발언: ${message}`);
  });

  eventBus.on(EventType.TechnicalDebateTriggered, (event) => {
    const { sessionId } = event.payload as { sessionId: string };
    if (runDebateWithVisualization) {
      runDebateWithVisualization(sessionId);
    }
  });

  eventBus.on(EventType.TaskCompleted, (event) => {
    const { agentId, taskId } = event.payload as { agentId: string; taskId: string };
    const agent = agentManager.getAgent(agentId);
    if (agent) {
      hud.logSystem(`Task completed by ${agent.name}`, 'success');
      sound.playTaskComplete();
      toast.success('Task Completed', `${agent.name} 작업 완료!`);
      chat.sendMessage(agentId, agent.name, agent.role, '작업 완료했습니다!');
      
      const snap = agent.getSnapshot();
      particle.emitSparkle(snap.position, 0x3fb950, 15);
      
      if (taskId) {
        taskProgress.removeProgress(taskId);
      }
    }
  });

  eventBus.on(EventType.AgentArrived, (event) => {
    const { agentId } = event.payload as { agentId: string };
    const agent = agentManager.getAgent(agentId);
    if (agent) {
      particle.emitPuff(agent.getSnapshot().position);
    }
  });

  eventBus.on(EventType.TaskFailed, (event) => {
    const { agentId, taskId, reason } = event.payload as { agentId: string; taskId: string; reason?: string };
    const agent = agentManager.getAgent(agentId);
    if (agent) {
      hud.logError(`Task failed by ${agent.name}: ${reason || 'unknown error'}`);
      toast.error('Task Failed', `${agent.name}: ${reason || 'unknown'}`);
      if (taskId) {
        taskProgress.removeProgress(taskId);
      }
    }
  });
}
