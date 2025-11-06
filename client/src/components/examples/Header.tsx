import Header from '../Header';

export default function HeaderExample() {
  return <Header onAddClient={() => console.log('Add client clicked')} />;
}
