import { useState, useEffect } from 'react';
import { AgentDashboard } from './components/AgentDashboard';
import { ComputerUseAgent } from './agent/ComputerUseAgent';
import { AgentState } from './types/agent';

export default function App() {
  const [agent, setAgent] = useState<ComputerUseAgent | null>(null);
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeAgent = async () => {
      try {
        const newAgent = new ComputerUseAgent();
        
        // Set up event listeners
        newAgent.on('agent:status', (state: AgentState) => {
          setAgentState(state);
        });
        
        newAgent.on('agent:initialized', () => {
          setIsInitializing(false);
        });
        
        newAgent.on('agent:error', (error: any) => {
          console.error('Agent error:', error);
        });
        
        setAgent(newAgent);
        setAgentState(newAgent.getState());
      } catch (error) {
        console.error('Failed to initialize agent:', error);
        setIsInitializing(false);
      }
    };

    initializeAgent();
    
    return () => {
      if (agent) {
        agent.destroy();
      }
    };
  }, []);

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="text-muted-foreground">Initializing Computer Use Agent...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AgentDashboard agent={agent} agentState={agentState} />
    </div>
  );
}
