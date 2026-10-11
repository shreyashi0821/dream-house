import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Lobby from '@/pages/Lobby';
import Play from '@/pages/Play';
import { selectRoomCode } from '@/store/global.Selector';
import { enterRoom, leaveRoom } from '@/store/global.Slice';

/** Two screens: the lobby, and the world. The room code lives in the URL so it can be shared. */
export default function App() {
    const dispatch = useDispatch();
    const code = useSelector(selectRoomCode);

    useEffect(() => {
        const fromUrl = new URLSearchParams(window.location.search).get('room');
        if (fromUrl) dispatch(enterRoom(fromUrl.toUpperCase()));
        else dispatch(leaveRoom());
        const onPop = () => {
            const c = new URLSearchParams(window.location.search).get('room');
            dispatch(c ? enterRoom(c.toUpperCase()) : leaveRoom());
        };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, [dispatch]);

    useEffect(() => {
        const url = new URL(window.location.href);
        if (code && url.searchParams.get('room') !== code) {
            url.searchParams.set('room', code);
            window.history.pushState({}, '', url);
        }
    }, [code]);

    return code ? <Play code={code} /> : <Lobby />;
}
