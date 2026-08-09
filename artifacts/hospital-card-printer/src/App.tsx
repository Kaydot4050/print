import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Activity, CalendarDays, Check, Clipboard, Eraser, IdCard, Printer, RotateCcw, ShieldCheck, UserRound } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import facilityLogo from '@assets/CARD_1786263244412.png';

type CardDetails = {
  clientName: string;
  dateOfBirth: string;
  dateOfIssue: string;
  insuranceNumber: string;
  gender: string;
  ghimsNumber: string;
};

const queryClient = new QueryClient();
const initialDetails: CardDetails = {
  clientName: 'Ama Serwaa Mensah',
  dateOfBirth: '14 / 06 / 1991',
  dateOfIssue: '08 / 03 / 2025',
  insuranceNumber: 'NHIS-24-083741',
  gender: 'Female',
  ghimsNumber: 'GH-2025-083741',
};

const fields: Array<{ key: keyof CardDetails; label: string; placeholder: string; hint?: string; icon: typeof UserRound }> = [
  { key: 'clientName', label: 'Client name', placeholder: 'Enter full name', hint: 'As shown on official ID', icon: UserRound },
  { key: 'dateOfBirth', label: 'Date of birth', placeholder: 'DD / MM / YYYY', hint: 'Use day / month / year', icon: CalendarDays },
  { key: 'dateOfIssue', label: 'Date of issue', placeholder: 'DD / MM / YYYY', icon: CalendarDays },
  { key: 'insuranceNumber', label: 'NHIS / PRV insu no.', placeholder: 'Enter insurance number', icon: ShieldCheck },
  { key: 'gender', label: 'Gender', placeholder: 'e.g. Female', icon: UserRound },
  { key: 'ghimsNumber', label: 'GHIMS no.', placeholder: 'Enter GHIMS number', hint: 'Generates the barcode below', icon: Activity },
];

function barcodePattern(value: string) {
  const source = value.trim() || 'GHIMS';
  const bars: number[] = [2, 1, 2, 1, 3, 1];
  for (let i = 0; i < 42; i += 1) {
    const code = source.charCodeAt(i % source.length);
    bars.push(1 + (code % 3), 1 + ((code + i) % 2));
  }
  return bars;
}

function IdCardPreview({ details, print = false }: { details: CardDetails; print?: boolean }) {
  const bars = useMemo(() => barcodePattern(details.ghimsNumber), [details.ghimsNumber]);
  return (
    <div className={print ? 'print-only' : 'preview-card-wrap'}>
      <article className="id-card" aria-label="Kasoa Polyclinic client identification card" data-testid={print ? 'card-print-preview' : 'card-preview'}>
        <header className="card-header">
          <div className="logo-window" aria-hidden="true">
            <img src={facilityLogo} alt="" />
          </div>
          <div className="facility-name">KASOA POLYCLINIC</div>
        </header>
        <h2 className="card-title">CLIENT IDENTIFICATION CARD</h2>
        <div className="card-content">
          <div className="card-client">
            <span className="card-label">CLIENT NAME:</span>
            <span className="card-value">{details.clientName || '—'}</span>
          </div>
          <div className="card-grid">
            <div>
              <span className="card-label">DATE OF BIRTH</span>
              <span className="card-value">{details.dateOfBirth || '—'}</span>
            </div>
            <div>
              <span className="card-label">DATE OF ISSUE</span>
              <span className="card-value">{details.dateOfIssue || '—'}</span>
            </div>
            <div>
              <span className="card-label">NHIS/PRV INSU NO.</span>
              <span className="card-value">{details.insuranceNumber || '—'}</span>
            </div>
          </div>
          <div className="card-ghims-row">
            <div>
              <span className="card-label">GENDER</span>
              <span className="card-value">{details.gender || '—'}</span>
            </div>
            <div>
              <span className="card-label">GHIMS NO: {details.ghimsNumber || '—'}</span>
              <div className="barcode" aria-label={`Barcode for ${details.ghimsNumber || 'empty GHIMS number'}`}>
                {bars.map((width, index) => <span key={`${width}-${index}`} style={{ width: `${width}px` }} />)}
              </div>
              <div className="barcode-caption">{details.ghimsNumber || 'GHIMS'}</div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

function Home() {
  const [details, setDetails] = useState<CardDetails>(() => {
    try {
      const saved = window.localStorage.getItem('kasoa-card-details');
      return saved ? { ...initialDetails, ...JSON.parse(saved) } : initialDetails;
    } catch {
      return initialDetails;
    }
  });
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    window.localStorage.setItem('kasoa-card-details', JSON.stringify(details));
    setSavedNotice(true);
    const timeout = window.setTimeout(() => setSavedNotice(false), 1300);
    return () => window.clearTimeout(timeout);
  }, [details]);

  const completed = Object.values(details).filter((value) => value.trim()).length;
  const updateField = (key: keyof CardDetails, value: string) => setDetails((current) => ({ ...current, [key]: value }));
  const resetDetails = () => {
    setDetails({ clientName: '', dateOfBirth: '', dateOfIssue: '', insuranceNumber: '', gender: '', ghimsNumber: '' });
  };
  const loadSample = () => setDetails(initialDetails);

  return (
    <main className="app-shell noise min-h-[100dvh]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1440px] flex-col">
        <header className="flex items-center justify-between gap-5 border-b border-[hsl(var(--border)/.8)] px-5 py-4 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-white shadow-md shadow-[hsl(var(--primary)/.2)]">
              <IdCard size={20} strokeWidth={2.3} />
            </div>
            <div>
              <div className="font-mono text-[10px] font-medium uppercase tracking-[.18em] text-[hsl(var(--primary))]">Front desk utility · 01</div>
              <h1 className="font-sans text-base font-extrabold tracking-[-.02em] text-[hsl(var(--foreground))] sm:text-lg">Cardroom / Kasoa</h1>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-white/50 px-3 py-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] sm:flex">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--primary))] shadow-[0_0_0_3px_hsl(var(--primary)/.12)]" />
            Local workspace
          </div>
        </header>

        <section className="grid flex-1 gap-7 px-5 py-7 sm:px-8 sm:py-10 lg:grid-cols-[minmax(380px,.83fr)_minmax(500px,1.17fr)] lg:gap-12 lg:px-12 lg:py-14">
          <div className="fade-up flex flex-col justify-center">
            <div className="mb-7 max-w-xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--accent)/.5)] bg-[hsl(var(--accent)/.15)] px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[.14em] text-[hsl(35_45%_29%)]">
                <Clipboard size={13} /> Ready for print
              </div>
              <h2 className="max-w-lg text-4xl font-extrabold leading-[.98] tracking-[-.06em] text-[hsl(var(--foreground))] sm:text-5xl lg:text-[4rem]">
                Make a patient card, <span className="text-[hsl(var(--primary))]">without the wait.</span>
              </h2>
              <p className="mt-5 max-w-md text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                Enter the client details once. The Kasoa Polyclinic card updates as you type, with a GHIMS barcode ready for the printer.
              </p>
            </div>

            <div className="rounded-2xl border border-[hsl(var(--border))] bg-white/65 p-4 shadow-[0_15px_40px_hsl(200_35%_25%/.06)] sm:p-5">
              <div className="mb-5 flex items-end justify-between gap-3 border-b border-[hsl(var(--border)/.75)] pb-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Client details</div>
                  <h3 className="mt-1 text-base font-extrabold text-[hsl(var(--foreground))]">Fill in the card</h3>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs font-medium text-[hsl(var(--primary))]" data-testid="status-fields-complete">{completed}/6</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">complete</div>
                </div>
              </div>
              <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
                {fields.map(({ key, label, placeholder, hint, icon: Icon }) => (
                  <label key={key} className={key === 'clientName' ? 'sm:col-span-2' : ''}>
                    <span className="field-label">
                      <span className="flex items-center gap-1.5"><Icon size={13} strokeWidth={2.2} />{label}</span>
                      {hint && <span className="field-hint hidden md:inline">{hint}</span>}
                    </span>
                    <input
                      className="field-input"
                      data-testid={`input-${key}`}
                      value={details[key]}
                      placeholder={placeholder}
                      aria-label={label}
                      onChange={(event) => updateField(key, event.target.value)}
                    />
                  </label>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--border)/.75)] pt-4">
                <button className="secondary-button" data-testid="button-reset" type="button" onClick={resetDetails}>
                  <Eraser size={15} /> Clear fields
                </button>
                <button className="text-xs font-bold text-[hsl(var(--primary))] underline decoration-[hsl(var(--primary)/.35)] underline-offset-4 transition-colors hover:text-[hsl(161_73%_27%)]" data-testid="button-load-sample" type="button" onClick={loadSample}>
                  Load sample details
                </button>
              </div>
            </div>
            <div className="mt-4 flex min-h-5 items-center gap-2 px-1 text-xs text-[hsl(var(--muted-foreground))]" aria-live="polite" data-testid="status-saved">
              {savedNotice && <><Check size={14} className="text-[hsl(var(--primary))]" /> Saved on this device</>}
            </div>
          </div>

          <div className="fade-up-delay flex flex-col justify-center">
            <div className="mb-3 flex items-end justify-between gap-4 px-1">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Live preview</div>
                <h3 className="mt-1 text-lg font-extrabold tracking-[-.025em] text-[hsl(var(--foreground))]">What will be printed</h3>
              </div>
              <div className="hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] sm:flex">
                <RotateCcw size={12} /> Updates instantly
              </div>
            </div>
            <div className="card-stage flex min-h-[300px] items-center justify-center rounded-2xl p-5 shadow-[0_22px_45px_hsl(201_43%_15%/.18)] sm:min-h-[420px] sm:p-10">
              <IdCardPreview details={details} />
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                <ShieldCheck size={15} className="text-[hsl(var(--primary))]" />
                 <span>CR80 card · 85.6 × 53.98 mm</span>
              </div>
              <button className="primary-button w-full sm:w-auto" data-testid="button-print" type="button" onClick={() => window.print()}>
                <Printer size={17} /> Print card
              </button>
            </div>
            <p className="mt-3 text-center text-[10px] leading-4 text-[hsl(var(--muted-foreground))] sm:text-right">Your details stay in this browser and are never sent to a server.</p>
          </div>
        </section>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[hsl(var(--border)/.7)] px-5 py-4 font-mono text-[9px] uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))] sm:px-8 lg:px-12">
          <span>Kasoa Polyclinic · Client services</span>
          <span>Cardroom v1.0</span>
        </footer>
      </div>
      <IdCardPreview details={details} print />
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;