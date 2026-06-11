import { useEffect } from 'react';

/**
 * Scroll-reveal: adds `.is-in` to every `.kz-reveal` element once it
 * enters the viewport. Pairs with the kz-reveal utility in kazutb.css
 * (reduced-motion users see content immediately).
 */
export default function useReveal(deps = []) {
    useEffect(() => {
        const elements = Array.from(document.querySelectorAll('.kz-reveal:not(.is-in)'));
        if (elements.length === 0) {
            return undefined;
        }

        if (typeof IntersectionObserver === 'undefined') {
            elements.forEach((el) => el.classList.add('is-in'));
            return undefined;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-in');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
        );

        elements.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
}
