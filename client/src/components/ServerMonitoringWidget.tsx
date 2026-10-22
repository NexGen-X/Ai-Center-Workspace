import React from 'react';
import { WorkspaceUsageWidget } from './WorkspaceUsageWidget.js';

interface ServerMonitoringWidgetProps {
  metrics?: any;
  onOpenSre?: () => void;
  onOpenPricing?: () => void;
  runningTasksCount?: number;
  completedTasksCount?: number;
  onlineAgentsCount?: number;
  activeProjectsCount?: number;
}

export const ServerMonitoringWidget: React.FC<ServerMonitoringWidgetProps> = (props) => {
  return (
    <WorkspaceUsageWidget
      runningTasksCount={props.runningTasksCount}
      completedTasksCount={props.completedTasksCount}
      onlineAgentsCount={props.onlineAgentsCount}
      activeProjectsCount={props.activeProjectsCount}
      onOpenPricing={props.onOpenPricing}
    />
  );
};
