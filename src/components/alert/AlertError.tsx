import { ExclamationTriangleIcon } from '@radix-ui/react-icons';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type AlertType = {
  description?: string;
};
const AlertError: React.FC<AlertType> = ({ description }) => {
  return (
    <div className="fixed right-4 top-4 z-50 rounded-md border-PersianRed bg-White font-sans shadow-xl">
      <Alert variant="destructive">
        <ExclamationTriangleIcon className="h-4 w-4 text-PersianRed" />
        <AlertTitle className="font-bold text-PersianRed">Lỗi</AlertTitle>
        <AlertDescription className="font-medium text-PersianRed">
          {description}
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default AlertError;
