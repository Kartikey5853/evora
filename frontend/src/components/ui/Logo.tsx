import GradientText from './GradientText';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

const Logo = ({ size = 'md', showText = true }: LogoProps) => {
  const textClasses = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
  };

  if (!showText) return null;

  return (
    <GradientText
      className={`font-display font-bold ${textClasses[size]} !mx-0`}
      colors={['#73E6CB', '#3EBB9E', '#00674F', '#3EBB9E']}
      animationSpeed={6}
    >
      Evora
    </GradientText>
  );
};

export default Logo;
