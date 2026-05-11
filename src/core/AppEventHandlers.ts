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
    try {
      const { prompt } = event.payload as { prompt: string };
      if (prompt.startsWith('/github')) {
        hud.logGitHub(`Starting workflow: ${prompt}`);
      } else {
        hud.logUser(prompt);
      }
    } catch (e) {
      console.error('[EventBus] Error in CommandReceived handler:', e);
    }
  });

  eventBus.on(EventType.TasksParsed, (event) => {
    try {
      const { tasks } = event.payload as { tasks: any[] };
      hud.logSystem(`Parsed ${tasks.length} tasks`, 'system');
    } catch (e) {
      console.error('[EventBus] Error in TasksParsed handler:', e);
    }
  });

  eventBus.on(EventType.TaskAssigned, (event) => {
    try {
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
    } catch (e) {
      console.error('[EventBus] Error in TaskAssigned handler:', e);
    }
  });

  eventBus.on(EventType.AgentStateChanged, (event) => {
    try {
      const { agentId, newState } = event.payload as { agentId: string; newState: AgentState };
      const agent = agentManager.getAgent(agentId);
      if (agent && newState === AgentState.Working) {
        chat.sendMessage(agentId, agent.name, agent.role, '작업 시작합니다!');
      }
    } catch (e) {
      console.error('[EventBus] Error in AgentStateChanged handler:', e);
    }
  });

  eventBus.on(EventType.AgentTalked, (event) => {
    try {
      const { message } = event.payload as { message: string };
      hud.logGitHub(`에이전트 발언: ${message}`);
    } catch (e) {
      console.error('[EventBus] Error in AgentTalked handler:', e);
    }
  });

  eventBus.on(EventType.TechnicalDebateTriggered, (event) => {
    try {
      const { sessionId } = event.payload as { sessionId: string };
      if (runDebateWithVisualization) {
        runDebateWithVisualization(sessionId).catch(err => {
          console.error('[EventBus] runDebateWithVisualization rejected:', err);
        });
      }
    } catch (e) {
      console.error('[EventBus] Error in TechnicalDebateTriggered handler:', e);
    }
  });

  eventBus.on(EventType.TaskCompleted, (event) => {
    try {
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
    } catch (e) {
      console.error('[EventBus] Error in TaskCompleted handler:', e);
    }
  });

  eventBus.on(EventType.AgentArrived, (event) => {
    try {
      const { agentId } = event.payload as { agentId: string };
      const agent = agentManager.getAgent(agentId);
      if (agent) {
        particle.emitPuff(agent.getSnapshot().position);
      }
    } catch (e) {
      console.error('[EventBus] Error in AgentArrived handler:', e);
    }
  });

  eventBus.on(EventType.TaskFailed, (event) => {
    try {
      const { agentId, taskId, reason } = event.payload as { agentId: string; taskId: string; reason?: string };
      const agent = agentManager.getAgent(agentId);
      if (agent) {
        hud.logError(`Task failed by ${agent.name}: ${reason || 'unknown error'}`);
        toast.error('Task Failed', `${agent.name}: ${reason || 'unknown'}`);
        if (taskId) {
          taskProgress.removeProgress(taskId);
        }
      }
    } catch (e) {
      console.error('[EventBus] Error in TaskFailed handler:', e);
    }
  });
}
