import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageHeader } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';
import { useEffect, useRef } from 'react';

// Firework sparks in the Qadam palette: teal, gold, copper, sky.
const SPARK_HUES = [177, 43, 24, 200];

export default function LoginImage() {
    const { auth } = usePage().props;
    const audioRef = useRef(null);
    const fireworksCanvasRef = useRef(null);
    const hasSeekedRef = useRef(false);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        const seekToStart = () => {
            if (hasSeekedRef.current) {
                return;
            }

            try {
                audio.currentTime = 18;
                hasSeekedRef.current = true;
            } catch {
                // Ignore seek errors before metadata is available.
            }
        };

        const tryPlay = async () => {
            try {
                await audio.play();
            } catch {
                // Autoplay can be blocked until first user interaction.
            }
        };

        const onFirstInteraction = () => {
            seekToStart();
            tryPlay();
            window.removeEventListener('pointerdown', onFirstInteraction);
            window.removeEventListener('touchstart', onFirstInteraction);
            window.removeEventListener('keydown', onFirstInteraction);
        };

        const onLoadedMetadata = () => {
            seekToStart();
            tryPlay();
        };

        if (audio.readyState >= 1) {
            seekToStart();
        }

        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        tryPlay();
        window.addEventListener('load', tryPlay);
        window.addEventListener('pageshow', tryPlay);
        window.addEventListener('pointerdown', onFirstInteraction, { once: true });
        window.addEventListener('touchstart', onFirstInteraction, { once: true });
        window.addEventListener('keydown', onFirstInteraction, { once: true });

        const retryTimer = window.setInterval(() => {
            if (audio.paused) {
                tryPlay();
            } else {
                window.clearInterval(retryTimer);
            }
        }, 1000);

        return () => {
            window.clearInterval(retryTimer);
            audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            window.removeEventListener('load', tryPlay);
            window.removeEventListener('pageshow', tryPlay);
            window.removeEventListener('pointerdown', onFirstInteraction);
            window.removeEventListener('touchstart', onFirstInteraction);
            window.removeEventListener('keydown', onFirstInteraction);
        };
    }, []);

    useEffect(() => {
        const canvas = fireworksCanvasRef.current;
        if (!canvas) {
            return;
        }

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion) {
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        let cssWidth = 0;
        let cssHeight = 0;
        let rafId = 0;
        let lastTime = performance.now();
        let spawnTimer = 0;

        const particles = [];

        const resizeCanvas = () => {
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;

            cssWidth = Math.max(1, rect.width);
            cssHeight = Math.max(1, rect.height);

            canvas.width = Math.floor(cssWidth * dpr);
            canvas.height = Math.floor(cssHeight * dpr);

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, cssWidth, cssHeight);
        };

        const createBurst = (x, y) => {
            const count = 26 + Math.floor(Math.random() * 18);

            for (let i = 0; i < count; i += 1) {
                const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
                const speed = 70 + Math.random() * 110;
                const life = 0.8 + Math.random() * 0.7;

                particles.push({
                    x,
                    y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life,
                    maxLife: life,
                    size: 1.4 + Math.random() * 2.4,
                    hue: SPARK_HUES[Math.floor(Math.random() * SPARK_HUES.length)],
                });
            }
        };

        const animate = (now) => {
            const dt = Math.min(0.033, (now - lastTime) / 1000);
            lastTime = now;
            spawnTimer += dt;

            if (spawnTimer > 0.72) {
                spawnTimer = 0;
                createBurst(
                    cssWidth * (0.15 + Math.random() * 0.7),
                    cssHeight * (0.12 + Math.random() * 0.4)
                );
            }

            // Keep the canvas fully transparent and redraw particles each frame.
            ctx.clearRect(0, 0, cssWidth, cssHeight);

            for (let i = particles.length - 1; i >= 0; i -= 1) {
                const p = particles[i];

                p.vy += 40 * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.life -= dt;

                if (p.life <= 0) {
                    particles.splice(i, 1);
                    continue;
                }

                const alpha = p.life / p.maxLife;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${p.hue}, 85%, 60%, ${alpha})`;
                ctx.fill();
            }

            rafId = window.requestAnimationFrame(animate);
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        rafId = window.requestAnimationFrame(animate);

        return () => {
            window.cancelAnimationFrame(rafId);
            window.removeEventListener('resize', resizeCanvas);
        };
    }, []);

    const userName = auth?.user?.name ?? null;
    const firstName = userName ? String(userName).trim().split(/\s+/).slice(1, 2)[0] ?? String(userName).trim().split(/\s+/)[0] : null;

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow={firstName ? `Здравствуйте, ${firstName}` : 'Добро пожаловать'}
                    title="Приветствие"
                    description="Изображение открывается автоматически при входе в систему. Когда будете готовы — переходите в панель."
                    actions={(
                        <Button asChild>
                            <Link href={route('dashboard')}>
                                Перейти в панель
                                <ArrowRight />
                            </Link>
                        </Button>
                    )}
                />
            )}
        >
            <Head title="Приветствие" />

            <div className="admin-page-wrap">
                <section className="relative isolate overflow-hidden rounded-[14px] bg-[#082834] px-4 py-6 sm:px-8 sm:py-8">
                    <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-teal-500/20 blur-3xl" aria-hidden="true" />
                    <div className="pointer-events-none absolute -bottom-32 -right-16 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" aria-hidden="true" />

                    <canvas
                        ref={fireworksCanvasRef}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 z-[9999] h-full w-full"
                    />

                    <div className="relative z-20 flex flex-col items-center gap-6">
                        <p className="qd-kicker text-teal-300">Qadam · Панель управления</p>

                        <div className="relative mx-auto w-fit overflow-hidden rounded-[14px]">
                            <img
                                src="/assets/images/azat-login-screen.png"
                                alt="Приветственное изображение"
                                className="block h-auto max-h-[calc(100vh-20rem)] max-w-full rounded-[14px] border border-white/10"
                            />
                            <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center text-[22px] font-semibold text-red-600 sm:text-lg">
                                <div className="flex items-center gap-[50px]">
                                    <span>Тимлид</span>
                                    <span>Тимлид</span>
                                </div>
                            </div>
                            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center text-[46px] font-semibold text-white sm:text-lg">
                                <div>
                                    джун
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <Button variant="default" asChild>
                                <Link href={route('dashboard')}>
                                    Перейти в панель
                                    <ArrowRight />
                                </Link>
                            </Button>
                            <span className="text-sm text-white/60">Музыка включится после первого касания или нажатия клавиши.</span>
                        </div>
                    </div>

                    <audio
                        ref={audioRef}
                        autoPlay
                        loop
                        preload="auto"
                        playsInline
                        className="hidden"
                    >
                        <source
                            src="https://cdn6.sefon.pro/prev/0GVu5-rrg3Dp_kpBbc_k-w/1779465691/702/6ellucci%20-%20%D0%9C%D0%B8%D0%BB%D0%BB%D0%B8%D0%BE%D0%BD%D0%B5%D1%80%20%28192kbps%29.mp3"
                            type="audio/mpeg"
                        />
                    </audio>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
