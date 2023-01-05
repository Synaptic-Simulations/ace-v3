import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TransformComponent, TransformWrapper } from '@pronestor/react-zoom-pan-pinch';
import { DndContext, DragEndEvent, useDndContext } from '@dnd-kit/core';
import { invoke } from '@tauri-apps/api/tauri';
import { useWorkspaceDispatch, useWorkspaceSelector, WorkspaceState } from '../redux/workspace';
import { setMenu } from '../redux/workspace/contextMenuSlice';
import { initializeSimVars } from '../redux/workspace/simVarSlice';
import { setInstruments, updateElementPosition } from '../redux/workspace/projectSlice';
import { Instrument } from '../components/Instrument';
import { SimVarsMenu } from '../components/menu/SimVarsMenu';
import { CanvasMenu } from '../components/contextmenu/CanvasMenu';
import { InstrumentConfig, SimVarMap } from '../types';
import { InteractableToggle } from '../components/toggles/InteractableToggle';

enum MenuTabs {
    SimVars,
}

export const Workspace: React.FC = () => {
    const [currentMenuTab, setMenuTab] = useState<MenuTabs | undefined>(undefined);

    const projectName = useWorkspaceSelector((state: WorkspaceState) => state.project.active?.name);
    const dispatch = useWorkspaceDispatch();

    const handleDragEnd = useCallback((e: DragEndEvent) => {
        const scale = e.active.data.current?.scale ?? 1;
        dispatch(updateElementPosition({
            uuid: e.active.id.toString(),
            dx: e.delta.x / scale,
            dy: e.delta.y / scale,
        }));
    }, [dispatch]);

    useEffect(() => {
        invoke<SimVarMap>('load_simvars')
            .then((simVars) => {
                dispatch(initializeSimVars({ simVars }));
                console.info(`[${projectName}] Loaded SimVars from project configuration`);
            });
        invoke<InstrumentConfig[]>('load_instruments')
            .then((instruments) => {
                dispatch(setInstruments({ instruments }));
                console.info(`[${projectName}] Loaded available instruments`);
            });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <DndContext onDragEnd={handleDragEnd}>
            <CanvasLayer />
            <div className="absolute left-0 top-0 h-screen bg-midnight-800 shadow-2xl p-4 z-20">
                <div className="flex flex-col items-center justify-between h-full">
                    <div className="flex flex-col gap-4">
                        <SimVarsMenu
                            show={currentMenuTab === MenuTabs.SimVars}
                            onClick={() => setMenuTab(MenuTabs.SimVars)}
                            onExit={() => setMenuTab(undefined)}
                        />
                    </div>
                    <div className="flex flex-col-reverse gap-4">
                        <InteractableToggle />
                    </div>
                </div>
            </div>
        </DndContext>
    );
};

const CanvasLayer: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);

    const project = useWorkspaceSelector((state: WorkspaceState) => state.project.active);
    const dispatch = useWorkspaceDispatch();

    const dndContext = useDndContext();

    return (
        <TransformWrapper
            disabled={dndContext.active !== null}
            centerOnInit
            minScale={0.25}
            initialScale={0.25}
            wheel={{ step: 0.15 }}
            velocityAnimation={{ equalToMove: false }}
        >
            <TransformComponent wrapperClass="w-screen h-screen overflow-hidden">
                <div
                    ref={containerRef}
                    className="w-[8000px] h-[5000px] bg-grid"
                    onClick={() => (document.activeElement as HTMLElement)?.blur()}
                    onContextMenu={(e) => {
                        e.preventDefault();

                        if (e.target === containerRef.current) {
                            dispatch(setMenu(<CanvasMenu x={e.clientX} y={e.clientY} />));
                        }
                    }}
                >
                    {project?.elements?.map((props) => (
                        <Instrument {...props} />
                    ))}
                </div>
            </TransformComponent>
            <ContextMenuLayer />
        </TransformWrapper>
    );
};

const ContextMenuLayer: React.FC = () => {
    const activeMenu = useWorkspaceSelector((state: WorkspaceState) => state.contextMenu.active);

    return (
        <div className="absolute top-0 left-0 w-screen h-screen pointer-events-none">
            {activeMenu}
        </div>
    );
};
