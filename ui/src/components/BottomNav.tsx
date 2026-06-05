'use client';

import { useState, useCallback } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { motion } from 'framer-motion';
import { Undo2, LayoutGrid, Equal, GitBranch, Redo2 } from 'lucide-react';
import { historyTreeAtom, currentNodeIdAtom, activeBottomSheetAtom } from '../store/equation';

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

  // Center button dispatches event for RadialMenu
  const handleOpenRadialMenu = useCallback(() => {
    window.dispatchEvent(new CustomEvent('open-radial-menu'));
  }, []);

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
          disabled={!canUndo}
          onClick={handleUndo}
        />

        {/* Workspace */}
        <NavButton
          icon={<LayoutGrid size={24} />}
          label="Workspace"
          active={activeBottomSheet === 'workspace'}
          onClick={handleToggleWorkspace}
        />

        {/* Center = button */}
        <div className="flex flex-col items-center flex-1">
          <motion.button
            onClick={handleOpenRadialMenu}
            className="relative -mt-3 w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/40"
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
          >
            <Equal size={24} className="text-white" />
            {/* Glow ring */}
            <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-md -z-10" />
          </motion.button>
          <span className="text-[10px] text-white/50 mt-0.5">Solve</span>
        </div>

        {/* History */}
        <NavButton
          icon={<GitBranch size={24} />}
          label="History"
          active={activeBottomSheet === 'history'}
          onClick={handleToggleHistory}
        />

        {/* Redo */}
        <NavButton
          icon={<Redo2 size={24} />}
          label="Redo"
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
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex flex-col items-center justify-center flex-1 py-1.5 transition-colors
        ${disabled ? 'opacity-30 pointer-events-none' : ''}
        ${active ? 'text-indigo-400' : 'text-white/50 active:text-white/80'}
      `}
    >
      {icon}
      <span className="text-[10px] mt-0.5">{label}</span>
    </button>
  );
};
