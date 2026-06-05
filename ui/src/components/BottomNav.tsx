'use client';

import { useState, useCallback } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { motion } from 'framer-motion';
import { Undo2, LayoutGrid, GitBranch, Redo2 } from 'lucide-react';
import { historyTreeAtom, currentNodeIdAtom, activeBottomSheetAtom } from '../store/equation';
import { Tooltip } from './Tooltip';

/**
 * BottomNav — Fixed bottom navigation bar for mobile.
 *
 * Layout: Undo | Workspace | = | History | Redo
 *
 * - Only visible on screens < 1024px (hidden via `xl:hidden`)
 * - Glass-morphic dark theme with safe area padding
 * - Center "=" button dispatches 'open-radial-menu' custom event
 * - Undo/Redo navigate the history tree linearly
 * - Workspace and History toggle their respective bottom sheets
 */

export const BottomNav: React.FC = () => {
  const [activeBottomSheet, setActiveBottomSheet] = useAtom(activeBottomSheetAtom);

  const tree = useAtomValue(historyTreeAtom);
  const [currentNodeId, setCurrentNodeId] = useAtom(currentNodeIdAtom);

  // Undo: navigate to parent node
  const currentNode = tree[currentNodeId];
  const canUndo = !!currentNode?.parentId;

  const handleUndo = useCallback(() => {
    if (currentNode?.parentId) {
      setCurrentNodeId(currentNode.parentId);
    }
  }, [currentNode, setCurrentNodeId]);

  // Redo: navigate to first child node
  const canRedo = !!currentNode?.childrenIds?.length;

  const handleRedo = useCallback(() => {
    if (currentNode?.childrenIds?.length) {
      setCurrentNodeId(currentNode.childrenIds[0]);
    }
  }, [currentNode, setCurrentNodeId]);


  const handleToggleWorkspace = useCallback(() => {
    setActiveBottomSheet((prev) => (prev === 'workspace' ? null : 'workspace'));
  }, [setActiveBottomSheet]);

  const handleToggleHistory = useCallback(() => {
    setActiveBottomSheet((prev) => (prev === 'history' ? null : 'history'));
  }, [setActiveBottomSheet]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 xl:hidden bg-neutral-950/90 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-end justify-around h-14 px-2">
        {/* Undo */}
        <NavButton
          icon={<Undo2 size={24} />}
          label="Undo"
          tooltip="Undo last step (⌘Z)"
          disabled={!canUndo}
          onClick={handleUndo}
        />

        {/* Workspace */}
        <NavButton
          icon={<LayoutGrid size={24} />}
          label="Workspace"
          tooltip="Workspace presets & templates (⌘B)"
          active={activeBottomSheet === 'workspace'}
          onClick={handleToggleWorkspace}
        />


        {/* History */}
        <NavButton
          icon={<GitBranch size={24} />}
          label="History"
          tooltip="History tree / timeline (⌘H)"
          active={activeBottomSheet === 'history'}
          onClick={handleToggleHistory}
        />

        {/* Redo */}
        <NavButton
          icon={<Redo2 size={24} />}
          label="Redo"
          tooltip="Redo step (⌘⇧Z)"
          disabled={!canRedo}
          onClick={handleRedo}
        />
      </div>
    </nav>
  );
};

/**
 * NavButton — A single bottom nav item with icon and label.
 */
interface NavButtonProps {
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({
  icon,
  label,
  tooltip,
  active = false,
  disabled = false,
  onClick,
}) => {
  return (
    <Tooltip content={tooltip} position="top" autoAlign={false} wrapperClassName="flex-1 flex justify-center">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          flex flex-col items-center justify-center w-full py-1.5 transition-colors
          ${disabled ? 'opacity-30 pointer-events-none' : ''}
          ${active ? 'text-indigo-400' : 'text-white/50 active:text-white/80'}
        `}
      >
        {icon}
        <span className="text-[10px] mt-0.5">{label}</span>
      </button>
    </Tooltip>
  );
};
