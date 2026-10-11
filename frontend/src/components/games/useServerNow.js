import { useEffect, useState } from 'react';

/** The server's clock, ticking a few times a second, for countdowns. */
export default function useServerNow(offset, every = 250) {
    const [now, setNow] = useState(() => Date.now() + offset);
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now() + offset), every);
        return () => clearInterval(t);
    }, [offset, every]);
    return now;
}
