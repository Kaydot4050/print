import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Activity, CalendarDays, Check, Eraser, IdCard, Printer, RotateCcw, ShieldCheck, UserRound, History, Clock, Trash2, Settings, X, SlidersHorizontal } from 'lucide-react';
import { format, parse } from 'date-fns';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import facilityLogo from '@assets/CARD_1786263244412.png';

type PrintOrientation = 'horizontal' | 'vertical';

type VersionFontSettings = {
  nameSizePt: number;
  nameWeight: number;
  labelSizePt: number;
  labelWeight: number;
  valueSizePt: number;
  valueWeight: number;
  identifierSizePt: number;
  identifierWeight: number;
  textBlurPx: number;
  identifierOffsetYMm: number;
  nhisOffsetXMm: number;
  rotate180?: boolean;
  orientation?: PrintOrientation;
};

type PrintFontSettingsByVersion = Record<CardVersion, VersionFontSettings>;

const defaultVersionFontSettings: Record<CardVersion, VersionFontSettings> = {
  v1: {
    nameSizePt: 7.0,
    nameWeight: 600,
    labelSizePt: 4.4,
    labelWeight: 600,
    valueSizePt: 6.8,
    valueWeight: 600,
    identifierSizePt: 6.8,
    identifierWeight: 600,
    textBlurPx: 0.2,
    identifierOffsetYMm: -0.2,
    nhisOffsetXMm: 0,
    rotate180: false,
    orientation: 'horizontal',
  },
  v2: {
    nameSizePt: 7.0,
    nameWeight: 600,
    labelSizePt: 5.0,
    labelWeight: 600,
    valueSizePt: 6.4,
    valueWeight: 600,
    identifierSizePt: 6.4,
    identifierWeight: 600,
    textBlurPx: 0.25,
    identifierOffsetYMm: 0.3,
    nhisOffsetXMm: 0,
    rotate180: false,
    orientation: 'horizontal',
  },
};

type CardDetails = {
  clientName: string;
  dateOfBirth: string;
  dateOfIssue: string;
  insuranceNumber: string;
  gender: string;
  ghimsNumber: string;
};

type CardVersion = 'v1' | 'v2';

type PrintHistoryRecord = {
  id: string;
  timestamp: number;
  version: CardVersion;
  details: CardDetails;
};

const queryClient = new QueryClient();
const initialV1Details: CardDetails = {
  clientName: 'AMA SERWAA MENSAH',
  dateOfBirth: '14/06/1991',
  dateOfIssue: '',
  insuranceNumber: 'NHIS-24-083741',
  gender: 'Female',
  ghimsNumber: 'GH-2025-083741',
};

const initialV2Details: CardDetails = {
  clientName: 'DORIS ESSOUN',
  dateOfBirth: '01-Jan-1990',
  dateOfIssue: '',
  insuranceNumber: '',
  gender: 'Female',
  ghimsNumber: 'C-0054-26080842',
};

const blankDetailsBase: Omit<CardDetails, 'dateOfIssue'> = {
  clientName: '',
  dateOfBirth: '',
  insuranceNumber: '',
  gender: '',
  ghimsNumber: '',
};

function compactDate(value: string) {
  return value.replace(/\s*\/\s*/g, '/').replace(/\s*-\s*/g, '-');
}

function getVersionContent(version: CardVersion) {
  return version === 'v1'
    ? {
        label: 'LIHMS',
        placeholder: 'DD/MM/YYYY',
        dateHint: 'Use day/month/year',
        sample: withDefaultIssueDate(initialV1Details, 'v1'),
      }
    : {
        label: 'GHIMS',
        placeholder: 'DD-Mmm-YYYY',
        dateHint: 'Use day - month - year',
        sample: withDefaultIssueDate(initialV2Details, 'v2'),
      };
}

const GENDER_OPTIONS = ['Female', 'Male', 'Other'] as const;

function getFields(version: CardVersion): Array<{ key: keyof CardDetails; label: string; placeholder: string; hint?: string; icon: typeof UserRound; options?: readonly string[] }> {
  const content = getVersionContent(version);
  return [
    { key: 'clientName', label: 'Client name', placeholder: 'Enter full name', hint: 'As shown on official ID', icon: UserRound },
    { key: 'dateOfBirth', label: 'Date of birth', placeholder: content.placeholder, hint: content.dateHint, icon: CalendarDays },
    { key: 'dateOfIssue', label: 'Date of issue', placeholder: content.placeholder, icon: CalendarDays },
    { key: 'insuranceNumber', label: 'NHIS / PRV insu no.', placeholder: 'Enter insurance number', icon: ShieldCheck },
    { key: 'gender', label: 'Gender', placeholder: 'Select gender', icon: UserRound, options: GENDER_OPTIONS },
    { key: 'ghimsNumber', label: `${content.label} no.`, placeholder: `Enter ${content.label} number`, hint: 'Generates the barcode below', icon: Activity },
  ];
}

const DATE_FORMATS: Record<CardVersion, { display: string; iso: string; label: string; monthCase?: 'upper' | 'title' }> = {
  v1: { display: "dd' / 'MM' / 'yyyy", iso: 'dd / MM / yyyy', label: 'DD / MM / YYYY' },
  v2: { display: "dd'-'MMM'-'yyyy", iso: "dd-MMM-yyyy", label: 'DD-Mmm-YYYY', monthCase: 'title' },
};

function normalizeMonthCase(input: string, version: CardVersion): string {
  if (version !== 'v2') return input;
  return input.replace(
    /([A-Za-z]{3})/g,
    (_m, m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase(),
  );
}

function formatCardDate(date: Date, version: CardVersion): string {
  const fmt = DATE_FORMATS[version];
  const raw = format(date, fmt.iso);
  return normalizeMonthCase(raw, version);
}

function todayIssueDate(version: CardVersion): string {
  return formatCardDate(new Date(), version);
}

function blankDetailsFor(version: CardVersion): CardDetails {
  return { ...blankDetailsBase, dateOfIssue: todayIssueDate(version) };
}

function withDefaultIssueDate(details: CardDetails, version: CardVersion): CardDetails {
  if (details.dateOfIssue?.trim()) return details;
  return { ...details, dateOfIssue: todayIssueDate(version) };
}

function parseCardDate(value: string, version: CardVersion): Date | undefined {
  if (!value || !value.trim()) return undefined;
  const fmt = DATE_FORMATS[version];
  const cleaned = normalizeMonthCase(value.trim(), version);
  const candidates: string[] = [fmt.iso];
  if (version === 'v1') candidates.push('dd/MM/yyyy', 'dd-MM-yyyy', 'yyyy-MM-dd');
  if (version === 'v2') candidates.push('dd MMM yyyy', 'dd/MMM/yyyy', 'yyyy-MM-dd');
  for (const pattern of candidates) {
    try {
      const d = parse(cleaned, pattern, new Date());
      if (d && !Number.isNaN(d.getTime())) return d;
    } catch {
      /* try next */
    }
  }
  return undefined;
}

function DatePickerField({
  version,
  value,
  onChange,
  placeholder,
  'data-testid': testId,
  ariaLabel,
}: {
  version: CardVersion;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  'data-testid'?: string;
  ariaLabel?: string;
}) {
  const selected = useMemo(() => parseCardDate(value, version), [value, version]);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(() => selected ?? new Date());

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setMonth(selected ?? new Date());
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          data-testid={testId}
          aria-label={ariaLabel}
          className="field-input h-[44px] justify-between px-3 font-normal text-left shadow-none hover:bg-white [&_svg]:size-4 [&_svg]:text-[hsl(var(--muted-foreground))]"
        >
          <span className={selected ? 'truncate' : 'truncate text-[hsl(var(--muted-foreground)/.74)]'}>
            {selected ? value || formatCardDate(selected, version) : placeholder}
          </span>
          <CalendarDays size={15} strokeWidth={2} aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
          className="border w-auto rounded-lg border-[hsl(192_22%_84%)] bg-white p-0 text-[hsl(205_28%_17%)] shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-popover-content-transform-origin]"
          align="start"
          sideOffset={6}
        >
          <Calendar
            mode="single"
            captionLayout="dropdown"
            fromYear={1900}
            toYear={new Date().getFullYear() + 10}
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            onSelect={(date) => {
              if (date) onChange(formatCardDate(date, version));
            }}
            className="rounded-md !bg-white [--cell-size:2rem] [[data-slot=card-content]_&]:bg-white [[data-slot=popover-content]_&]:bg-white [&_.rdp-dropdown_root]:!bg-white [&_.rdp-dropdowns]:!bg-white [&_.rdp-button_previous]:!bg-white [&_.rdp-button_next]:!bg-white [&_.rdp-button_previous:hover]:!bg-[hsl(195_40%_92%)] [&_.rdp-button_next:hover]:!bg-[hsl(195_40%_92%)] [&_.rdp-caption_label]:!text-[hsl(205_28%_17%)]"
            initialFocus
          />
      </PopoverContent>
    </Popover>
  );
}

function barcodePattern(value: string) {
  const source = value.trim() || 'GHIMS';
  const elements: Array<{ isBar: boolean; width: number }> = [
    { isBar: true, width: 2 },
    { isBar: false, width: 1 },
    { isBar: true, width: 1 },
    { isBar: false, width: 1 },
    { isBar: true, width: 3 },
    { isBar: false, width: 1 },
  ];
  for (let i = 0; i < 42; i += 1) {
    const code = source.charCodeAt(i % source.length);
    const barWidth = i % 5 === 0 ? 3 : 1 + (code % 2);
    const gapWidth = 1 + ((code + i) % 2);
    elements.push({ isBar: true, width: barWidth });
    elements.push({ isBar: false, width: gapWidth });
  }
  elements.push(
    { isBar: true, width: 2 },
    { isBar: false, width: 1 },
    { isBar: true, width: 3 },
  );
  return elements;
}

function NhisPrvLabel({ version, suffix }: { version: CardVersion; suffix: string }) {
  if (version === 'v2') {
    return (
      <>
        NHIS<span className="nhis-slash-v2">/</span>PRV{suffix}
      </>
    );
  }
  return <>NHIS/PRV{suffix}</>;
}

function HorizontalMidRow({
  details,
  version,
}: {
  details: CardDetails;
  version: CardVersion;
}) {
  return (
    <div className="print-film-3col">
      <div className="print-film-col">
        <span className="print-film-label">DATE OF BIRTH</span>
        <span className="print-film-value">{details.dateOfBirth.trim() ? compactDate(details.dateOfBirth) : '—'}</span>
      </div>
      <div className="print-film-col">
        <span className="print-film-label">{version === 'v1' ? 'DATE ISSUED:' : 'DATE OF ISSUE'}</span>
        <span className="print-film-value">{details.dateOfIssue.trim() ? compactDate(details.dateOfIssue) : '—'}</span>
      </div>
      <div className="print-film-col print-film-col-nhis">
        <span className="print-film-label"><NhisPrvLabel version={version} suffix=" INSU NO." /></span>
        {details.insuranceNumber.trim() ? (
          <span className="print-film-value print-film-nhis-value">{details.insuranceNumber.trim()}</span>
        ) : null}
      </div>
    </div>
  );
}

function IdCardPreview({ details, version, fontSettings }: { details: CardDetails; version: CardVersion; fontSettings?: VersionFontSettings }) {
  const s = fontSettings || defaultVersionFontSettings[version] || defaultVersionFontSettings.v1;
  const bars = useMemo(() => barcodePattern(details.ghimsNumber), [details.ghimsNumber]);
  const systemLabel = getVersionContent(version).label;
  const orientation = s?.orientation ?? 'horizontal';
  const isVertical = orientation === 'vertical';

  const barcode = (
    <div className="print-film-barcode" aria-label={`Barcode for ${details.ghimsNumber || 'empty system number'}`}>
      {bars.map((item, index) => (
        <span
          key={index}
          className={item.isBar ? 'barcode-bar' : 'barcode-gap'}
          style={{ width: `${item.width}px` }}
        />
      ))}
    </div>
  );

  return (
    <div className="preview-card-wrap">
      <article
        className={`id-card id-card-${version} print-film print-film-${version} ${s?.rotate180 ? 'rotate-180' : ''} print-orientation-${orientation}`}
        style={{
          '--print-name-size': `${s.nameSizePt}pt`,
          '--print-name-weight': `${s.nameWeight ?? 700}`,
          '--print-label-size': `${s.labelSizePt}pt`,
          '--print-label-weight': `${version === 'v2' ? (s.valueWeight ?? 700) : (s.labelWeight ?? (version === 'v1' ? 600 : 500))}`,
          '--print-value-size': `${s.valueSizePt}pt`,
          '--print-value-weight': `${s.valueWeight ?? 700}`,
          '--print-identifier-size': `${s.identifierSizePt}pt`,
          '--print-identifier-weight': `${version === 'v2' ? (s.valueWeight ?? 700) : (s.identifierWeight ?? 700)}`,
          '--print-text-blur': `${s.textBlurPx ?? 0}px`,
          '--print-identifier-offset-y': `${s.identifierOffsetYMm ?? 0}mm`,
          '--print-nhis-offset-x': `${s.nhisOffsetXMm ?? 0}mm`,
        } as React.CSSProperties}
        aria-label={`Kasoa Polyclinic client identification card ${version}`}
        data-testid="card-preview"
      >
        <header className="card-header">
          <div className="logo-window" aria-hidden="true">
            <img src={facilityLogo} alt="" />
          </div>
          <div className="facility-name">KASOA POLYCLINIC</div>
        </header>
        <h2 className="card-title">CLIENT IDENTIFICATION CARD</h2>

        {isVertical ? (
          <div className="print-film-content-box print-film-vertical-box">
            <div className="print-film-vertical-fields">
              <div className="print-film-row print-film-row-name">
                <span className="print-film-label">CLIENT NAME:</span>
                <span className="print-film-value">{details.clientName.trim() ? details.clientName.toUpperCase() : '—'}</span>
              </div>
              <div className="print-film-row">
                <span className="print-film-label">DATE OF BIRTH:</span>
                <span className="print-film-value">{details.dateOfBirth.trim() ? compactDate(details.dateOfBirth) : '—'}</span>
              </div>
              <div className="print-film-row">
                <span className="print-film-label">GENDER:</span>
                <span className="print-film-value">{details.gender.trim() || '—'}</span>
              </div>
              <div className="print-film-row">
                <span className="print-film-label">DATE ISS:</span>
                <span className="print-film-value">{details.dateOfIssue.trim() ? compactDate(details.dateOfIssue) : '—'}</span>
              </div>
              <div className="print-film-row">
                <span className="print-film-label"><NhisPrvLabel version={version} suffix=":" /></span>
                {details.insuranceNumber.trim() ? (
                  <span className="print-film-value">{details.insuranceNumber.trim()}</span>
                ) : null}
              </div>
              <div className="print-film-row">
                <span className="print-film-label">{systemLabel}:</span>
                <span className="print-film-value print-film-identifier">{details.ghimsNumber.trim() || '—'}</span>
              </div>
            </div>
            <div className="print-film-vertical-barcode-wrap">{barcode}</div>
          </div>
        ) : (
          <div className="print-film-content-box print-film-horizontal-box">
            <div className="print-film-row print-film-row-name">
              <span className="print-film-label">CLIENT NAME:</span>
              <span className="print-film-value">{details.clientName.trim() ? details.clientName.toUpperCase() : '—'}</span>
            </div>
            <HorizontalMidRow details={details} version={version} />
            <div className="print-film-bottom">
              <div className="print-film-col print-film-col-gender">
                <span className="print-film-label">GENDER</span>
                <span className="print-film-value">{details.gender.trim() || '—'}</span>
              </div>
              <div className="print-film-col print-film-col-identifier">
                <div className="print-film-identifier-row">
                  <span className="print-film-label">{systemLabel} NO:</span>
                  <span className="print-film-value print-film-identifier">{details.ghimsNumber.trim() || '—'}</span>
                </div>
                {barcode}
              </div>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}

function PrintFilmSheet({ details, version, fontSettings }: { details: CardDetails; version: CardVersion; fontSettings: VersionFontSettings }) {
  const bars = useMemo(() => barcodePattern(details.ghimsNumber), [details.ghimsNumber]);
  const systemLabel = getVersionContent(version).label;
  const orientation = fontSettings?.orientation ?? 'horizontal';
  const isVertical = orientation === 'vertical';

  const barcode = (
    <div className="print-film-barcode" aria-label={`Barcode for ${details.ghimsNumber || 'empty system number'}`}>
      {bars.map((item, index) => (
        <span
          key={index}
          className={item.isBar ? 'barcode-bar' : 'barcode-gap'}
          style={{ width: `${item.width}px` }}
        />
      ))}
    </div>
  );

  return (
    <div className={`print-only ${fontSettings?.rotate180 ? 'rotate-180' : ''} print-orientation-${orientation}`}>
      <article
        className={`print-film print-film-${version} ${fontSettings?.rotate180 ? 'rotate-180' : ''} print-orientation-${orientation}`}
        style={{
          '--print-name-size': `${fontSettings.nameSizePt}pt`,
          '--print-name-weight': `${fontSettings.nameWeight ?? 700}`,
          '--print-label-size': `${fontSettings.labelSizePt}pt`,
          '--print-label-weight': `${version === 'v2' ? (fontSettings.valueWeight ?? 700) : (fontSettings.labelWeight ?? (version === 'v1' ? 600 : 500))}`,
          '--print-value-size': `${fontSettings.valueSizePt}pt`,
          '--print-value-weight': `${fontSettings.valueWeight ?? 700}`,
          '--print-identifier-size': `${fontSettings.identifierSizePt}pt`,
          '--print-identifier-weight': `${version === 'v2' ? (fontSettings.valueWeight ?? 700) : (fontSettings.identifierWeight ?? 700)}`,
          '--print-text-blur': `${fontSettings.textBlurPx ?? 0}px`,
          '--print-identifier-offset-y': `${fontSettings.identifierOffsetYMm ?? 0}mm`,
          '--print-nhis-offset-x': `${fontSettings.nhisOffsetXMm ?? 0}mm`,
        } as React.CSSProperties}
        aria-label="Card print data"
        data-testid="card-print-preview"
      >
        {isVertical ? (
          <div className="print-film-content-box print-film-vertical-box">
            <div className="print-film-vertical-fields">
              <div className="print-film-row print-film-row-name">
                <span className="print-film-label">CLIENT NAME:</span>
                <span className="print-film-value">{details.clientName.trim() ? details.clientName.toUpperCase() : '—'}</span>
              </div>
              <div className="print-film-row">
                <span className="print-film-label">DATE OF BIRTH:</span>
                <span className="print-film-value">{details.dateOfBirth.trim() ? compactDate(details.dateOfBirth) : '—'}</span>
              </div>
              <div className="print-film-row">
                <span className="print-film-label">GENDER:</span>
                <span className="print-film-value">{details.gender.trim() || '—'}</span>
              </div>
              <div className="print-film-row">
                <span className="print-film-label">DATE ISS:</span>
                <span className="print-film-value">{details.dateOfIssue.trim() ? compactDate(details.dateOfIssue) : '—'}</span>
              </div>
              <div className="print-film-row">
                <span className="print-film-label"><NhisPrvLabel version={version} suffix=":" /></span>
                {details.insuranceNumber.trim() ? (
                  <span className="print-film-value">{details.insuranceNumber.trim()}</span>
                ) : null}
              </div>
              <div className="print-film-row">
                <span className="print-film-label">{systemLabel}:</span>
                <span className="print-film-value print-film-identifier">{details.ghimsNumber.trim() || '—'}</span>
              </div>
            </div>
            <div className="print-film-vertical-barcode-wrap">{barcode}</div>
          </div>
        ) : (
          <div className="print-film-content-box print-film-horizontal-box">
            <div className="print-film-row print-film-row-name">
              <span className="print-film-label">CLIENT NAME:</span>
              <span className="print-film-value">{details.clientName.trim() ? details.clientName.toUpperCase() : '—'}</span>
            </div>
            <HorizontalMidRow details={details} version={version} />
            <div className="print-film-bottom">
              <div className="print-film-col print-film-col-gender">
                <span className="print-film-label">GENDER</span>
                <span className="print-film-value">{details.gender.trim() || '—'}</span>
              </div>
              <div className="print-film-col print-film-col-identifier">
                <div className="print-film-identifier-row">
                  <span className="print-film-label">{systemLabel} NO:</span>
                  <span className="print-film-value print-film-identifier">{details.ghimsNumber.trim() || '—'}</span>
                </div>
                {barcode}
              </div>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}

function Home() {
  const [cardVersion, setCardVersion] = useState<CardVersion>(() => {
    try {
      const saved = window.localStorage.getItem('kasoa-card-version');
      return saved === 'v2' ? 'v2' : 'v1';
    } catch {
      return 'v1';
    }
  });
  const [detailsByVersion, setDetailsByVersion] = useState<Record<CardVersion, CardDetails>>(() => {
    try {
      const saved = window.localStorage.getItem('kasoa-card-details');
      const parsed = saved ? JSON.parse(saved) : null;
      if (parsed?.v1 && parsed?.v2) {
        return {
          v1: withDefaultIssueDate({ ...initialV1Details, ...parsed.v1 }, 'v1'),
          v2: withDefaultIssueDate({ ...initialV2Details, ...parsed.v2 }, 'v2'),
        };
      }
      return {
        v1: withDefaultIssueDate(saved ? { ...initialV1Details, ...parsed } : initialV1Details, 'v1'),
        v2: withDefaultIssueDate(initialV2Details, 'v2'),
      };
    } catch {
      return {
        v1: withDefaultIssueDate(initialV1Details, 'v1'),
        v2: withDefaultIssueDate(initialV2Details, 'v2'),
      };
    }
  });
  const [savedNotice, setSavedNotice] = useState(false);
  const [printHistory, setPrintHistory] = useState<PrintHistoryRecord[]>(() => {
    try {
      const saved = window.localStorage.getItem('kasoa-card-history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [fontSettingsByVersion, setFontSettingsByVersion] = useState<PrintFontSettingsByVersion>(() => {
    try {
      const saved = window.localStorage.getItem('kasoa-card-font-settings-v2');
      const parsed = saved ? JSON.parse(saved) : null;
      if (parsed?.v1 && parsed?.v2) {
        const mergeVersion = (ver: CardVersion, savedVer: VersionFontSettings) => {
          const merged = {
            ...defaultVersionFontSettings[ver],
            ...savedVer,
            textBlurPx: typeof savedVer?.textBlurPx === 'number' ? savedVer.textBlurPx : defaultVersionFontSettings[ver].textBlurPx,
            identifierOffsetYMm: typeof savedVer?.identifierOffsetYMm === 'number' ? savedVer.identifierOffsetYMm : defaultVersionFontSettings[ver].identifierOffsetYMm,
            nhisOffsetXMm: typeof savedVer?.nhisOffsetXMm === 'number'
              ? savedVer.nhisOffsetXMm
              : (savedVer as VersionFontSettings & { nhisPosition?: string })?.nhisPosition === 'left'
                ? -8
                : defaultVersionFontSettings[ver].nhisOffsetXMm,
            rotate180: Boolean(savedVer?.rotate180),
            orientation: savedVer?.orientation ?? 'horizontal',
          };
          // V1 only: soft bump old default 500 → slight bold 600
          if (ver === 'v1' && merged.labelWeight === 500) merged.labelWeight = 600;
          // V1: LIHMS no. size always tracks field values
          if (ver === 'v1') {
            merged.identifierSizePt = merged.valueSizePt;
            merged.identifierWeight = merged.valueWeight;
          }
          // V2: labels a little larger than old 4.4 default
          if (ver === 'v2' && (merged.labelSizePt === 4.4 || merged.labelSizePt === 4.7)) merged.labelSizePt = 5.0;
          // V2: migrate prior defaults → current (weights 600, blur 0.25, offset 0.3)
          if (ver === 'v2') {
            if (merged.valueWeight === 800 || merged.valueWeight === 700) merged.valueWeight = 600;
            if (merged.labelWeight === 800 || merged.labelWeight === 700) merged.labelWeight = 600;
            if (merged.nameWeight === 800 || merged.nameWeight === 700) merged.nameWeight = 600;
            if (merged.identifierWeight === 800 || merged.identifierWeight === 700) merged.identifierWeight = 600;
            if (merged.valueSizePt === 6.8) merged.valueSizePt = 6.4;
            if (merged.textBlurPx === 0.2) merged.textBlurPx = 0.25;
            if (merged.identifierOffsetYMm === 1.4) merged.identifierOffsetYMm = 0.3;
            merged.labelWeight = merged.valueWeight;
            merged.identifierWeight = merged.valueWeight;
            merged.nameWeight = merged.valueWeight;
            merged.identifierSizePt = merged.valueSizePt;
          }
          return merged;
        };
        return {
          v1: mergeVersion('v1', parsed.v1),
          v2: mergeVersion('v2', parsed.v2),
        };
      }
      return defaultVersionFontSettings;
    } catch {
      return defaultVersionFontSettings;
    }
  });
  const [settingsVersionTab, setSettingsVersionTab] = useState<CardVersion>(cardVersion);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => {
    if (!showPrintPreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPrintPreview(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPrintPreview]);

  const activeFontSettings = fontSettingsByVersion[cardVersion];
  const settingsTabFontSettings = fontSettingsByVersion[settingsVersionTab];

  const updateClientNameSize = (targetVersion: CardVersion, size: number) => {
    setFontSettingsByVersion((current) => {
      const updated = {
        ...current,
        [targetVersion]: { ...current[targetVersion], nameSizePt: size },
      };
      window.localStorage.setItem('kasoa-card-font-settings-v2', JSON.stringify(updated));
      return updated;
    });
  };

  const updateClientNameWeight = (targetVersion: CardVersion, weight: number) => {
    setFontSettingsByVersion((current) => {
      const updated = {
        ...current,
        [targetVersion]: { ...current[targetVersion], nameWeight: weight },
      };
      window.localStorage.setItem('kasoa-card-font-settings-v2', JSON.stringify(updated));
      return updated;
    });
  };

  const updateFieldLabelsSize = (targetVersion: CardVersion, size: number) => {
    setFontSettingsByVersion((current) => {
      const updated = {
        ...current,
        [targetVersion]: { ...current[targetVersion], labelSizePt: size },
      };
      window.localStorage.setItem('kasoa-card-font-settings-v2', JSON.stringify(updated));
      return updated;
    });
  };

  const updateFieldLabelsWeight = (targetVersion: CardVersion, weight: number) => {
    setFontSettingsByVersion((current) => {
      const updated = {
        ...current,
        [targetVersion]: { ...current[targetVersion], labelWeight: weight },
      };
      window.localStorage.setItem('kasoa-card-font-settings-v2', JSON.stringify(updated));
      return updated;
    });
  };

  const updateFieldValuesSize = (targetVersion: CardVersion, size: number) => {
    setFontSettingsByVersion((current) => {
      const updated = {
        ...current,
        [targetVersion]: {
          ...current[targetVersion],
          valueSizePt: size,
          identifierSizePt: size,
        },
      };
      window.localStorage.setItem('kasoa-card-font-settings-v2', JSON.stringify(updated));
      return updated;
    });
  };

  const updateFieldValuesWeight = (targetVersion: CardVersion, weight: number) => {
    setFontSettingsByVersion((current) => {
      const updated = {
        ...current,
        [targetVersion]: {
          ...current[targetVersion],
          valueWeight: weight,
          identifierWeight: weight,
        },
      };
      window.localStorage.setItem('kasoa-card-font-settings-v2', JSON.stringify(updated));
      return updated;
    });
  };

  const updateRotate180 = (targetVersion: CardVersion, rotate: boolean) => {
    setFontSettingsByVersion((current) => {
      const updated = {
        ...current,
        [targetVersion]: { ...current[targetVersion], rotate180: rotate },
      };
      window.localStorage.setItem('kasoa-card-font-settings-v2', JSON.stringify(updated));
      return updated;
    });
  };

  const updateOrientation = (targetVersion: CardVersion, orientation: PrintOrientation) => {
    setFontSettingsByVersion((current) => {
      const updated = {
        ...current,
        [targetVersion]: { ...current[targetVersion], orientation },
      };
      window.localStorage.setItem('kasoa-card-font-settings-v2', JSON.stringify(updated));
      return updated;
    });
  };

  const updateNhisOffsetX = (targetVersion: CardVersion, offsetMm: number) => {
    setFontSettingsByVersion((current) => {
      const updated = {
        ...current,
        [targetVersion]: { ...current[targetVersion], nhisOffsetXMm: offsetMm },
      };
      window.localStorage.setItem('kasoa-card-font-settings-v2', JSON.stringify(updated));
      return updated;
    });
  };

  const updateTextBlur = (targetVersion: CardVersion, blurPx: number) => {
    setFontSettingsByVersion((current) => {
      const updated = {
        ...current,
        [targetVersion]: { ...current[targetVersion], textBlurPx: blurPx },
      };
      window.localStorage.setItem('kasoa-card-font-settings-v2', JSON.stringify(updated));
      return updated;
    });
  };

  const updateIdentifierOffsetY = (targetVersion: CardVersion, offsetMm: number) => {
    setFontSettingsByVersion((current) => {
      const updated = {
        ...current,
        [targetVersion]: { ...current[targetVersion], identifierOffsetYMm: offsetMm },
      };
      window.localStorage.setItem('kasoa-card-font-settings-v2', JSON.stringify(updated));
      return updated;
    });
  };

  const resetFontSettings = (targetVersion: CardVersion) => {
    setFontSettingsByVersion((current) => {
      const updated = {
        ...current,
        [targetVersion]: { ...defaultVersionFontSettings[targetVersion] },
      };
      window.localStorage.setItem('kasoa-card-font-settings-v2', JSON.stringify(updated));
      return updated;
    });
  };

  const details = detailsByVersion[cardVersion];
  const fields = getFields(cardVersion);

  useEffect(() => {
    window.localStorage.setItem('kasoa-card-details', JSON.stringify(detailsByVersion));
    setSavedNotice(true);
    const timeout = window.setTimeout(() => setSavedNotice(false), 1300);
    return () => window.clearTimeout(timeout);
  }, [detailsByVersion]);

  useEffect(() => {
    window.localStorage.setItem('kasoa-card-version', cardVersion);
  }, [cardVersion]);

  const completed = Object.values(details).filter((value) => value.trim()).length;
  const updateField = (key: keyof CardDetails, value: string) => {
    const nextValue = key === 'clientName' ? value.toUpperCase() : value;
    setDetailsByVersion((current) => ({
      ...current,
      [cardVersion]: { ...current[cardVersion], [key]: nextValue },
    }));
  };
  const resetDetails = () => {
    setDetailsByVersion((current) => ({ ...current, [cardVersion]: blankDetailsFor(cardVersion) }));
  };
  const loadSample = () => setDetailsByVersion((current) => ({ ...current, [cardVersion]: getVersionContent(cardVersion).sample }));

  const isPrintingRef = useRef(false);

  const handlePrint = () => {
    setShowPrintPreview(true);
  };

  const confirmPrint = () => {
    if (isPrintingRef.current) return;
    isPrintingRef.current = true;

    const newRecord: PrintHistoryRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
      timestamp: Date.now(),
      version: cardVersion,
      details: { ...details },
    };
    
    setPrintHistory((current) => {
      const updated = [newRecord, ...current].slice(0, 20);
      window.localStorage.setItem('kasoa-card-history', JSON.stringify(updated));
      return updated;
    });

    setShowPrintPreview(false);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        isPrintingRef.current = false;
      }, 1200);
    }, 60);
  };

  const clearHistory = () => {
    setPrintHistory([]);
    window.localStorage.removeItem('kasoa-card-history');
  };

  const deleteHistoryRecord = (id: string) => {
    setPrintHistory((current) => {
      const updated = current.filter((item) => item.id !== id);
      window.localStorage.setItem('kasoa-card-history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleReprint = (record: PrintHistoryRecord) => {
    setCardVersion(record.version);
    setDetailsByVersion((current) => ({
      ...current,
      [record.version]: { ...record.details },
    }));
    setTimeout(() => setShowPrintPreview(true), 80);
  };

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
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-white/70 px-3.5 py-2 text-xs font-bold text-[hsl(var(--foreground))] shadow-sm transition-all hover:bg-white hover:shadow-md active:scale-95"
              data-testid="button-open-settings"
              title="Print font settings"
            >
              <Settings size={15} className="text-[hsl(var(--primary))]" />
              <span>Print Font Settings</span>
            </button>
            <div className="hidden items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-white/50 px-3 py-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] md:flex">
              <span className="h-2 w-2 rounded-full bg-[hsl(var(--primary))] shadow-[0_0_0_3px_hsl(var(--primary)/.12)]" />
              Local workspace
            </div>
          </div>
        </header>

        <section className="grid flex-1 gap-7 px-5 py-7 sm:px-8 sm:py-10 lg:grid-cols-[minmax(380px,.83fr)_minmax(500px,1.17fr)] lg:gap-12 lg:px-12 lg:py-14">
          <div className="fade-up flex flex-col justify-center">
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-white/65 p-4 shadow-[0_15px_40px_hsl(200_35%_25%/.06)] sm:p-5">
               <div className="version-switch" role="group" aria-label="Choose card version">
                 <span className="version-switch-label">Card version</span>
                 <div className="version-switch-options">
                   {(['v1', 'v2'] as const).map((version) => (
                     <button
                       key={version}
                       className={`version-option ${cardVersion === version ? 'active' : ''}`}
                       data-testid={`button-${version}`}
                       type="button"
                       aria-pressed={cardVersion === version}
                       onClick={() => setCardVersion(version)}
                     >
                       {version.toUpperCase()}
                       <span>{version === 'v1' ? 'LIHMS' : 'GHIMS'}</span>
                     </button>
                   ))}
                 </div>
               </div>
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
                {fields.map(({ key, label, placeholder, hint, icon: Icon, options }) => (
                  <label key={key} className={key === 'clientName' ? 'sm:col-span-2' : ''}>
                    <span className="field-label">
                      <span className="flex items-center gap-1.5"><Icon size={13} strokeWidth={2.2} />{label}</span>
                      {hint && <span className="field-hint hidden md:inline">{hint}</span>}
                    </span>
                    {key === 'dateOfBirth' || key === 'dateOfIssue' ? (
                      <DatePickerField
                        version={cardVersion}
                        value={details[key]}
                        placeholder={placeholder}
                        data-testid={`input-${key}`}
                        ariaLabel={label}
                        onChange={(next) => updateField(key, next)}
                      />
                    ) : options ? (
                      <Select
                        value={details[key] || undefined}
                        onValueChange={(next) => updateField(key, next)}
                      >
                        <SelectTrigger
                          className="field-input h-[44px] justify-between px-3 font-normal text-left shadow-none hover:bg-white [&_svg]:size-4 [&_svg]:text-[hsl(var(--muted-foreground))]"
                          data-testid={`input-${key}`}
                          aria-label={label}
                        >
                          <SelectValue placeholder={placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <input
                        className="field-input"
                        data-testid={`input-${key}`}
                        value={details[key]}
                        placeholder={placeholder}
                        aria-label={label}
                        onChange={(event) => updateField(key, event.target.value)}
                      />
                    )}
                  </label>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--border)/.75)] pt-4">
                <button className="secondary-button" data-testid="button-reset" type="button" onClick={resetDetails}>
                  <Eraser size={15} /> Clear fields
                </button>
                <button className="text-xs font-bold text-[hsl(var(--primary))] underline decoration-[hsl(var(--primary)/.35)] underline-offset-4 transition-colors hover:text-[hsl(0_72%_35%)]" data-testid="button-load-sample" type="button" onClick={loadSample}>
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
               <IdCardPreview details={details} version={cardVersion} fontSettings={activeFontSettings} />
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                <ShieldCheck size={15} className="text-[hsl(var(--primary))]" />
                 <span>CR80 overlay · details + barcode only · {cardVersion.toUpperCase()}</span>
              </div>
              <button className="primary-button w-full sm:w-auto" data-testid="button-print" type="button" onClick={handlePrint}>
                 <Printer size={17} /> Print data only
              </button>
            </div>
             <p className="mt-3 text-center text-[10px] leading-4 text-[hsl(var(--muted-foreground))] sm:text-right">Prints client details and barcode onto the pre-printed PVC card. Logo and hospital name are not printed.</p>
          </div>
        </section>

        <section className="px-5 pb-10 sm:px-8 lg:px-12">
          <div className="mb-4 flex items-center justify-between border-b border-[hsl(var(--border)/.75)] pb-3">
            <div className="flex items-center gap-2">
              <History size={18} className="text-[hsl(var(--primary))]" />
              <h3 className="font-bold text-[hsl(var(--foreground))]">Print History</h3>
              {printHistory.length > 0 && (
                <span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">({printHistory.length})</span>
              )}
            </div>
            {printHistory.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.08)] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--destructive))] transition-colors hover:bg-[hsl(var(--destructive))] hover:text-white"
                data-testid="button-clear-history"
              >
                <Trash2 size={13} /> Clear all
              </button>
            )}
          </div>
          {printHistory.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-[hsl(var(--border))] px-5 py-6 text-sm text-[hsl(var(--muted-foreground))]">
              <Printer size={16} className="shrink-0 opacity-40" />
              No prints yet. Click <strong className="mx-1 text-[hsl(var(--foreground))]">Print data only</strong> to record a print.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {printHistory.map((record) => (
                <div key={record.id} className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-white/40 p-3 shadow-sm">
                  <div className="flex flex-col gap-1 overflow-hidden">
                    <span className="truncate font-semibold text-[hsl(var(--foreground))] text-sm">
                      {record.details.clientName || 'Unnamed Client'}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-mono">
                      <Clock size={10} /> {new Date(record.timestamp).toLocaleString()} &middot; {record.version.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReprint(record)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary))] hover:text-white"
                      title="Reprint"
                    >
                      <Printer size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteHistoryRecord(record.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-transparent text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--destructive)/.1)] hover:text-[hsl(var(--destructive))]"
                      title="Delete record"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[hsl(var(--border)/.7)] px-5 py-4 font-mono text-[9px] uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))] sm:px-8 lg:px-12">
          <span>Kasoa Polyclinic · Client services</span>
          <span>Cardroom {cardVersion.toUpperCase()}</span>
        </footer>
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex max-h-[min(92vh,720px)] w-full max-w-md flex-col rounded-2xl border border-[hsl(var(--border))] bg-white p-4 shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-[hsl(var(--border)/.8)] pb-2.5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-[hsl(var(--primary))]" />
                <h2 className="text-base font-extrabold text-[hsl(var(--foreground))]">Print Font Settings</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-slate-100"
              >
                <X size={15} />
              </button>
            </div>

            {/* Version Switch Tabs inside Settings Modal */}
            <div className="mt-3 flex shrink-0 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.4)] p-0.5">
              {(['v1', 'v2'] as const).map((ver) => (
                <button
                  key={ver}
                  type="button"
                  onClick={() => setSettingsVersionTab(ver)}
                  className={`flex-1 rounded-lg py-1 text-center text-xs font-extrabold transition-all ${
                    settingsVersionTab === ver
                      ? 'bg-white text-[hsl(var(--primary))] shadow-sm'
                      : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                  }`}
                >
                  {ver.toUpperCase()} ({ver === 'v1' ? 'LIHMS' : 'GHIMS'})
                </button>
              ))}
            </div>

            <div className="mt-3 min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain pr-1">
              {/* Client Name Control Card */}
              <div className="rounded-xl border border-[hsl(var(--border)/.8)] bg-slate-50/80 p-2.5 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-[hsl(var(--border)/.6)] pb-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-[hsl(var(--primary))]">Client Name Value</p>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Controls name size & weight</span>
                </div>
                <div>
                  <label className="flex justify-between text-[11px] font-bold text-[hsl(var(--foreground))]">
                    <span>Font Size</span>
                    <span className="font-mono font-extrabold text-[hsl(var(--primary))]">{settingsTabFontSettings.nameSizePt} pt</span>
                  </label>
                  <input type="range" min="5.0" max="12.0" step="0.1" value={settingsTabFontSettings.nameSizePt}
                    onChange={(e) => updateClientNameSize(settingsVersionTab, parseFloat(e.target.value))}
                    className="mt-0.5 w-full accent-[hsl(var(--primary))]" />
                </div>
                <div>
                  <label className="flex justify-between text-[11px] font-bold text-[hsl(var(--foreground))]">
                    <span>Font Weight</span>
                    <span className="font-mono font-extrabold text-[hsl(var(--primary))]">{settingsTabFontSettings.nameWeight}</span>
                  </label>
                  <input type="range" min="100" max="900" step="50" value={settingsTabFontSettings.nameWeight}
                    onChange={(e) => updateClientNameWeight(settingsVersionTab, parseInt(e.target.value))}
                    className="mt-0.5 w-full accent-[hsl(var(--primary))]" />
                </div>
              </div>

              {/* All Field Labels Control Card */}
              <div className="rounded-xl border border-[hsl(var(--border)/.8)] bg-slate-50/80 p-2.5 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-[hsl(var(--border)/.6)] pb-1">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-[hsl(var(--primary))]">All Field Labels</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Headings (CLIENT NAME:, DOB, GENDER...)</p>
                  </div>
                </div>
                <div>
                  <label className="flex justify-between text-[11px] font-bold text-[hsl(var(--foreground))]">
                    <span>Font Size</span>
                    <span className="font-mono font-extrabold text-[hsl(var(--primary))]">{settingsTabFontSettings.labelSizePt} pt</span>
                  </label>
                  <input type="range" min="4.5" max="10.0" step="0.1" value={settingsTabFontSettings.labelSizePt}
                    onChange={(e) => updateFieldLabelsSize(settingsVersionTab, parseFloat(e.target.value))}
                    className="mt-0.5 w-full accent-[hsl(var(--primary))]" />
                </div>
                <div>
                  <label className="flex justify-between text-[11px] font-bold text-[hsl(var(--foreground))]">
                    <span>Font Weight</span>
                    <span className="font-mono font-extrabold text-[hsl(var(--primary))]">{settingsTabFontSettings.labelWeight}</span>
                  </label>
                  <input type="range" min="100" max="900" step="50" value={settingsTabFontSettings.labelWeight}
                    onChange={(e) => updateFieldLabelsWeight(settingsVersionTab, parseInt(e.target.value))}
                    className="mt-0.5 w-full accent-[hsl(var(--primary))]" />
                </div>
              </div>

              {/* All Field Values Control Card */}
              <div className="rounded-xl border border-[hsl(var(--border)/.8)] bg-slate-50/80 p-2.5 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-[hsl(var(--border)/.6)] pb-1">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-[hsl(var(--primary))]">All Field Values</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Values (DOB, Issue Date, NHIS, Gender, No)</p>
                  </div>
                </div>
                <div>
                  <label className="flex justify-between text-[11px] font-bold text-[hsl(var(--foreground))]">
                    <span>Font Size</span>
                    <span className="font-mono font-extrabold text-[hsl(var(--primary))]">{settingsTabFontSettings.valueSizePt} pt</span>
                  </label>
                  <input type="range" min="4.5" max="12.0" step="0.1" value={settingsTabFontSettings.valueSizePt}
                    onChange={(e) => updateFieldValuesSize(settingsVersionTab, parseFloat(e.target.value))}
                    className="mt-0.5 w-full accent-[hsl(var(--primary))]" />
                </div>
                <div>
                  <label className="flex justify-between text-[11px] font-bold text-[hsl(var(--foreground))]">
                    <span>Font Weight</span>
                    <span className="font-mono font-extrabold text-[hsl(var(--primary))]">{settingsTabFontSettings.valueWeight}</span>
                  </label>
                  <input type="range" min="100" max="900" step="50" value={settingsTabFontSettings.valueWeight}
                    onChange={(e) => updateFieldValuesWeight(settingsVersionTab, parseInt(e.target.value))}
                    className="mt-0.5 w-full accent-[hsl(var(--primary))]" />
                </div>
              </div>

              {/* Text Blur Control Card */}
              <div className="rounded-xl border border-[hsl(var(--border)/.8)] bg-slate-50/80 p-2.5 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-[hsl(var(--border)/.6)] pb-1">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-[hsl(var(--primary))]">Print Text Blur</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Softens printed labels, values &amp; barcode</p>
                  </div>
                </div>
                <div>
                  <label className="flex justify-between text-[11px] font-bold text-[hsl(var(--foreground))]">
                    <span>Blur Amount</span>
                    <span className="font-mono font-extrabold text-[hsl(var(--primary))]">{(settingsTabFontSettings.textBlurPx ?? 0).toFixed(2)} px</span>
                  </label>
                  <input type="range" min="0" max="1.5" step="0.05" value={settingsTabFontSettings.textBlurPx ?? 0}
                    onChange={(e) => updateTextBlur(settingsVersionTab, parseFloat(e.target.value))}
                    className="mt-0.5 w-full accent-[hsl(var(--primary))]" />
                </div>
              </div>

              {/* Identifier + barcode vertical position */}
              <div className="rounded-xl border border-[hsl(var(--border)/.8)] bg-slate-50/80 p-2.5 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-[hsl(var(--border)/.6)] pb-1">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-[hsl(var(--primary))]">
                      {settingsVersionTab === 'v2' ? 'GHIMS No. & Barcode' : 'LIHMS No. & Barcode'}
                    </p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Move up (negative) or down (positive)</p>
                  </div>
                </div>
                <div>
                  <label className="flex justify-between text-[11px] font-bold text-[hsl(var(--foreground))]">
                    <span>Vertical Position</span>
                    <span className="font-mono font-extrabold text-[hsl(var(--primary))]">
                      {(settingsTabFontSettings.identifierOffsetYMm ?? 0).toFixed(1)} mm
                    </span>
                  </label>
                  <input
                    type="range"
                    min="-5"
                    max="5"
                    step="0.1"
                    value={settingsTabFontSettings.identifierOffsetYMm ?? 0}
                    onChange={(e) => updateIdentifierOffsetY(settingsVersionTab, parseFloat(e.target.value))}
                    className="mt-0.5 w-full accent-[hsl(var(--primary))]"
                  />
                  <div className="flex justify-between text-[10px] text-[hsl(var(--muted-foreground))]">
                    <span>Up</span>
                    <span>Down</span>
                  </div>
                </div>
              </div>

              {/* NHIS horizontal position */}
              <div className="rounded-xl border border-[hsl(var(--border)/.8)] bg-slate-50/80 p-2.5 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-[hsl(var(--border)/.6)] pb-1">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-[hsl(var(--primary))]">NHIS / PRV Insu No.</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Move left (negative) or right (positive)</p>
                  </div>
                </div>
                <div>
                  <label className="flex justify-between text-[11px] font-bold text-[hsl(var(--foreground))]">
                    <span>Horizontal Position</span>
                    <span className="font-mono font-extrabold text-[hsl(var(--primary))]">
                      {(settingsTabFontSettings.nhisOffsetXMm ?? 0).toFixed(1)} mm
                    </span>
                  </label>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    step="0.1"
                    value={settingsTabFontSettings.nhisOffsetXMm ?? 0}
                    onChange={(e) => updateNhisOffsetX(settingsVersionTab, parseFloat(e.target.value))}
                    className="mt-0.5 w-full accent-[hsl(var(--primary))]"
                  />
                  <div className="flex justify-between text-[10px] text-[hsl(var(--muted-foreground))]">
                    <span>Left</span>
                    <span>Right</span>
                  </div>
                </div>
              </div>

              {/* Print Orientation Selection Card */}
              <div className="rounded-xl border border-[hsl(var(--border)/.8)] bg-slate-50/80 p-2.5 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-[hsl(var(--border)/.6)] pb-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-[hsl(var(--primary))]">Print Orientation</p>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Card text orientation</span>
                </div>
                <div className="flex rounded-lg border border-[hsl(var(--border))] bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => updateOrientation(settingsVersionTab, 'horizontal')}
                    className={`flex-1 rounded-md py-1.5 text-center text-xs font-extrabold transition-all ${
                      (settingsTabFontSettings.orientation ?? 'horizontal') === 'horizontal'
                        ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                    }`}
                  >
                    Horizontal (Standard 0°)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateOrientation(settingsVersionTab, 'vertical')}
                    className={`flex-1 rounded-md py-1.5 text-center text-xs font-extrabold transition-all ${
                      settingsTabFontSettings.orientation === 'vertical'
                        ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                    }`}
                  >
                    Vertical (Rotated 90°)
                  </button>
                </div>
              </div>

              {/* 180 Degree Print Rotation Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--primary)/.3)] bg-[hsl(var(--primary)/.05)] p-2.5">
                <div>
                  <p className="text-xs font-extrabold text-[hsl(var(--foreground))]">Rotate Print 180°</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Flips print output upside down</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateRotate180(settingsVersionTab, !settingsTabFontSettings.rotate180)}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settingsTabFontSettings.rotate180 ? 'bg-[hsl(var(--primary))]' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settingsTabFontSettings.rotate180 ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
            <div className="mt-3 flex shrink-0 items-center justify-between border-t border-[hsl(var(--border)/.8)] pt-2.5">
              <button
                type="button"
                onClick={() => resetFontSettings(settingsVersionTab)}
                className="text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:underline"
              >
                Reset {settingsVersionTab.toUpperCase()} Defaults
              </button>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="primary-button !min-h-[36px] !px-4 !py-1 text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrintPreview && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPrintPreview(false); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="print-preview-title"
        >
          <div className="w-full max-w-[640px] rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <IdCard size={18} className="text-[hsl(var(--primary))]" />
                <div>
                  <h2 id="print-preview-title" className="text-[15px] font-bold tracking-[-.02em] text-[hsl(var(--foreground))]">
                    Print Preview
                  </h2>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Readable orientation · {cardVersion.toUpperCase()} · printer will rotate automatically</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintPreview(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
                aria-label="Close preview"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
              <div className="card-stage flex min-h-[260px] items-center justify-center rounded-2xl p-5 shadow-[0_22px_45px_hsl(201_43%_15%/.18)] sm:min-h-[320px] sm:p-8">
                <IdCardPreview details={details} version={cardVersion} fontSettings={activeFontSettings} />
              </div>
            </div>

            <div className="flex flex-col-reverse items-stretch gap-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/.25)] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setShowPrintPreview(false)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[hsl(var(--border))] bg-white px-4 text-sm font-semibold text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--accent))]"
              >
                <X size={15} /> Cancel
              </button>
              <button
                type="button"
                onClick={confirmPrint}
                className="primary-button h-10 w-full sm:w-auto"
              >
                <Printer size={16} /> Confirm & Print
              </button>
            </div>
          </div>
        </div>
      )}

      <PrintFilmPortal details={details} version={cardVersion} fontSettings={activeFontSettings} />
    </main>
  );
}

function PrintFilmPortal({ details, version, fontSettings }: { details: CardDetails; version: CardVersion; fontSettings: VersionFontSettings }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(typeof document !== 'undefined' && !!document.body);
  }, []);
  if (!mounted) return null;
  return createPortal(
    <PrintFilmSheet details={details} version={version} fontSettings={fontSettings} />,
    document.body,
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