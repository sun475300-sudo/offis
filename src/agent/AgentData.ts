import { AgentConfig, AgentRole } from '../types';

/**
 * Standard development team agents
 */
export const INITIAL_AGENTS: AgentConfig[] = [
  // Frontend Developers (Row 2)
  { id: 'fe-1', name: '김철수', role: AgentRole.Frontend, homeDesk: { col: 2, row: 2 }, speed: 8, color: 0x4FC3F7 },
  { id: 'fe-2', name: '이영희', role: AgentRole.Frontend, homeDesk: { col: 4, row: 2 }, speed: 8, color: 0x29B6F6 },
  { id: 'fe-3', name: '박지민', role: AgentRole.Frontend, homeDesk: { col: 6, row: 2 }, speed: 9, color: 0x03A9F4 },
  { id: 'fe-4', name: '정수현', role: AgentRole.Frontend, homeDesk: { col: 8, row: 2 }, speed: 8, color: 0x039BE5 },
  
  // Backend Developers (Row 4)
  { id: 'be-1', name: '최민호', role: AgentRole.Backend, homeDesk: { col: 2, row: 4 }, speed: 8, color: 0x81C784 },
  { id: 'be-2', name: '강다현', role: AgentRole.Backend, homeDesk: { col: 4, row: 4 }, speed: 8, color: 0x66BB6A },
  { id: 'be-3', name: '윤서연', role: AgentRole.Backend, homeDesk: { col: 6, row: 4 }, speed: 7, color: 0x4CAF50 },
  { id: 'be-4', name: '신동현', role: AgentRole.Backend, homeDesk: { col: 8, row: 4 }, speed: 10, color: 0x43A047 },
  
  // Designers (Row 6)
  { id: 'ds-1', name: '한지민', role: AgentRole.Designer, homeDesk: { col: 2, row: 6 }, speed: 8, color: 0xFFB74D },
  { id: 'ds-2', name: '오하은', role: AgentRole.Designer, homeDesk: { col: 4, row: 6 }, speed: 8, color: 0xFFA726 },
  { id: 'ds-3', name: '이다은', role: AgentRole.Designer, homeDesk: { col: 6, row: 6 }, speed: 8, color: 0xFF9800 },
  { id: 'ds-4', name: '윤보라', role: AgentRole.Designer, homeDesk: { col: 8, row: 6 }, speed: 9, color: 0xFB8C00 },
  
  // PMs (Row 8)
  { id: 'pm-1', name: '임정호', role: AgentRole.PM, homeDesk: { col: 2, row: 8 }, speed: 7, color: 0xE57373 },
  { id: 'pm-2', name: '조민지', role: AgentRole.PM, homeDesk: { col: 4, row: 8 }, speed: 7, color: 0xEF5350 },
  { id: 'pm-3', name: '서현우', role: AgentRole.PM, homeDesk: { col: 6, row: 8 }, speed: 8, color: 0xF44336 },
  
  // QA Engineers (Row 10)
  { id: 'qa-1', name: '황보경', role: AgentRole.QA, homeDesk: { col: 2, row: 10 }, speed: 10, color: 0xBA68C8 },
  { id: 'qa-2', name: '문소연', role: AgentRole.QA, homeDesk: { col: 4, row: 10 }, speed: 8, color: 0xAB47BC },
  { id: 'qa-3', name: '배유진', role: AgentRole.QA, homeDesk: { col: 6, row: 10 }, speed: 9, color: 0x9C27B0 },
  { id: 'qa-4', name: '차하늘', role: AgentRole.QA, homeDesk: { col: 8, row: 10 }, speed: 8, color: 0x8E24AA },
  
  // DevOps Engineers (Row 12)
  { id: 'do-1', name: '장현준', role: AgentRole.DevOps, homeDesk: { col: 2, row: 12 }, speed: 3, color: 0x90A4AE },
  { id: 'do-2', name: '구본욱', role: AgentRole.DevOps, homeDesk: { col: 4, row: 12 }, speed: 3.5, color: 0x78909C },
  { id: 'do-3', name: '남도열', role: AgentRole.DevOps, homeDesk: { col: 6, row: 12 }, speed: 3, color: 0x607D8B },
  { id: 'do-4', name: '양동현', role: AgentRole.DevOps, homeDesk: { col: 8, row: 12 }, speed: 2.8, color: 0x546E7A },
  
  // Additional Frontend (Row 14)
  { id: 'fe-5', name: '서민준', role: AgentRole.Frontend, homeDesk: { col: 2, row: 14 }, speed: 3, color: 0x00BCD4 },
  { id: 'fe-6', name: '류지수', role: AgentRole.Frontend, homeDesk: { col: 4, row: 14 }, speed: 3.2, color: 0x00ACC1 },
  
  // Additional Backend (Row 16)
  { id: 'be-5', name: '전민재', role: AgentRole.Backend, homeDesk: { col: 2, row: 16 }, speed: 3, color: 0x9CCC65 },
  { id: 'be-6', name: '홍길동', role: AgentRole.Backend, homeDesk: { col: 4, row: 16 }, speed: 2.7, color: 0x8BC34A },
];

/**
 * Specialist review team agents
 */
export const REVIEW_AGENTS: AgentConfig[] = [
  { id: 'review-architect', name: '👨‍💻 수석 아키텍트', role: AgentRole.Architect, homeDesk: { col: 2, row: 18 }, speed: 2, color: 0x9C27B0 },
  { id: 'review-security', name: '🔒 보안/QA 엔지니어', role: AgentRole.SecurityEngineer, homeDesk: { col: 5, row: 18 }, speed: 2, color: 0xF44336 },
  { id: 'review-performance', name: '⚡ 성능 전문가', role: AgentRole.PerformanceEngineer, homeDesk: { col: 8, row: 18 }, speed: 2, color: 0xFF9800 },
  { id: 'review-security2', name: '🛡️ 침투 테스터', role: AgentRole.SecurityEngineer, homeDesk: { col: 11, row: 18 }, speed: 2.5, color: 0xE91E63 },
  { id: 'review-db', name: '🗄️ DB 전문가', role: AgentRole.PerformanceEngineer, homeDesk: { col: 14, row: 18 }, speed: 2, color: 0x00BCD4 },
];
