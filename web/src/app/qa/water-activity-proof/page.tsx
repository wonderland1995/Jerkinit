import JerkyValidationPage from '@/components/JerkyValidationPage';

export const metadata = {
  title: 'Jerky Drying Validation | QA',
  description: 'Validated drying process linking temperature, time, and weight loss to aw < 0.85.',
};

export default function Page() {
  return <JerkyValidationPage />;
}
