import { useEffect, useRef } from 'react';

function useClickOutside(close: () => void, open?: boolean) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const element = ref.current;
            if (element && !element.contains(event.target as Node)) {
                if (open) {
                    document.body.style.overflowY = 'auto'
                }
                close()
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [close]);
    return ref;
}
export default useClickOutside