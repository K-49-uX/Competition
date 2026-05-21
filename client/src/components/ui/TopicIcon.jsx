import {
  Droplets,
  HandHeart,
  Salad,
  Baby,
  HeartPulse,
  Pill,
  Syringe,
  Bug,
  GlassWater,
  Wind,
  Stethoscope,
  ShieldCheck,
  Users,
  Brain,
  BriefcaseMedical,
  AlertTriangle,
  Activity,
  Smile,
  Sparkles,
  BookOpen,
} from 'lucide-react';

// Map content slugs → lucide icon component for a polished, professional look.
const SLUG_ICONS = {
  'hand-washing': HandHeart,
  'safe-water': Droplets,
  'balanced-meals': Salad,
  'breastfeeding': Baby,
  'antenatal-care': HeartPulse,
  'iron-folic-acid': Pill,
  'childhood-vaccines': Syringe,
  'malaria-prevention': Bug,
  'diarrhoea-ors': GlassWater,
  'pneumonia-children': Wind,
  'tuberculosis': Stethoscope,
  'hiv-prevention': ShieldCheck,
  'family-planning': Users,
  'mental-health': Brain,
  'first-aid': BriefcaseMedical,
  'cholera': AlertTriangle,
  'covid-19': Activity,
  'noncommunicable-diseases': Activity,
  'gbv-support': ShieldCheck,
  'oral-health': Smile,
  'adolescent-health': Sparkles,
};

// Per-category color tokens (Tailwind classes already in the design system).
const CATEGORY_STYLES = {
  hygiene:   { bg: 'bg-primary-50 dark:bg-primary/15',  fg: 'text-primary dark:text-accent' },
  nutrition: { bg: 'bg-success/10',                      fg: 'text-success' },
  maternal:  { bg: 'bg-care/15',                         fg: 'text-care' },
  general:   { bg: 'bg-accent/15',                       fg: 'text-accent' },
};

export function topicIcon(slug) {
  return SLUG_ICONS[slug] || BookOpen;
}

export function topicCategoryStyle(category) {
  return CATEGORY_STYLES[category] || CATEGORY_STYLES.general;
}

/**
 * Render a square, rounded icon tile for an education topic.
 *
 * <TopicIcon slug={item.slug} category={item.category} size="md" />
 */
export function TopicIcon({ slug, category, size = 'md', className = '' }) {
  const Icon = topicIcon(slug);
  const { bg, fg } = topicCategoryStyle(category);
  const sizes = {
    sm: { box: 'w-9 h-9 rounded-lg',  icon: 18 },
    md: { box: 'w-12 h-12 rounded-xl', icon: 24 },
    lg: { box: 'w-16 h-16 rounded-2xl', icon: 30 },
  };
  const s = sizes[size] || sizes.md;
  return (
    <span
      aria-hidden
      className={`inline-grid place-items-center shrink-0 ${s.box} ${bg} ${fg} ${className}`}
    >
      <Icon size={s.icon} strokeWidth={2.2} />
    </span>
  );
}
