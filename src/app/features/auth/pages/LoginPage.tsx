import { LoginView } from '../../../components/LoginView';

type LoginPageProps = {
  demo?: boolean;
};

export function LoginPage({ demo = false }: LoginPageProps) {
  return <LoginView showDemoAccess={demo} />;
}
