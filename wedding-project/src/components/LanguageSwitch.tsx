import { SegmentedControl } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { changeAppLanguage } from '../i18n';

const LANGUAGES = [
    { label: 'ՀԱՅ', value: 'am' },
    { label: 'РУС', value: 'ru' },
    { label: 'ENG', value: 'en' },
];

function LanguageSwitch({ className }: { className?: string }) {
    const { i18n } = useTranslation();
    const current = LANGUAGES.find(lang => i18n.language?.startsWith(lang.value))?.value || 'am';
    return (
        <SegmentedControl
            className={className}
            size="xs"
            radius="xl"
            value={current}
            onChange={changeAppLanguage}
            data={LANGUAGES}
        />
    );
}

export default LanguageSwitch;
