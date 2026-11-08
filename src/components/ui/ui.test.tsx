/**
 * Component tests of the generic interface components, through their
 * visible behaviour and accessibility: roles, names, descriptions, states.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button.tsx';
import { ChoiceCards } from './ChoiceCards.tsx';
import { CompactChoice } from './CompactChoice.tsx';
import { Disclosure } from './Disclosure.tsx';
import { SegmentedControl } from './SegmentedControl.tsx';
import { Slider } from './Slider.tsx';
import { StatusMessage } from './StatusMessage.tsx';
import { Switch } from './Switch.tsx';
import { TextField } from './TextField.tsx';

describe('Button', () => {
  it('is a plain button by default, so it never submits a form by accident', () => {
    const onSubmit = vi.fn((event: SubmitEvent) => {
      event.preventDefault();
    });
    render(
      <form
        onSubmit={(event) => {
          onSubmit(event.nativeEvent);
        }}
      >
        <Button>Rejouer</Button>
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rejouer' }));

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('applies its variant and does not fire when disabled', () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" disabled onClick={onClick}>
        Tracer
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Tracer' });
    fireEvent.click(button);

    expect(button).toHaveClass('button--primary');
    expect(button).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps its label and the focus while loading, and ignores clicks', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Button variant="primary" onClick={onClick}>
        Télécharger
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Télécharger' });
    button.focus();

    rerender(
      <Button variant="primary" loading onClick={onClick}>
        Télécharger
      </Button>,
    );
    fireEvent.click(button);

    expect(button).toHaveFocus();
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleName('Télécharger');
    expect(button.querySelector('.button__spinner')).toHaveAttribute('aria-hidden', 'true');
    expect(onClick).not.toHaveBeenCalled();

    rerender(
      <Button variant="primary" onClick={onClick}>
        Télécharger
      </Button>,
    );
    fireEvent.click(button);

    expect(button).not.toHaveAttribute('aria-busy');
    expect(button).not.toHaveAttribute('aria-disabled');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('TextField', () => {
  it('links the label, help and counter to the input', () => {
    render(
      <TextField
        id="intention"
        label="Intention"
        value=""
        onValueChange={vi.fn()}
        help="Une phrase courte."
        counter="0 lettre"
      />,
    );

    const input = screen.getByLabelText('Intention');
    expect(input).toHaveAccessibleDescription(/^Une phrase courte\. 0 lettre\s*$/);
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  it('marks the input invalid and describes it with the error', () => {
    render(
      <TextField
        id="intention"
        label="Intention"
        value=""
        onValueChange={vi.fn()}
        error="Écrivez une intention."
      />,
    );

    const input = screen.getByLabelText('Intention');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Écrivez une intention.');
  });

  it('reports every change of the text', () => {
    const onValueChange = vi.fn();
    render(<TextField id="intention" label="Intention" value="" onValueChange={onValueChange} />);

    fireEvent.change(screen.getByLabelText('Intention'), { target: { value: 'Je' } });

    expect(onValueChange).toHaveBeenCalledWith('Je');
  });
});

describe('SegmentedControl', () => {
  it('groups native radios under a legend and disables unavailable options', () => {
    render(
      <SegmentedControl
        legend="Méthode"
        name="method"
        value="kamea"
        onChange={vi.fn()}
        options={[
          { value: 'spare', label: 'Spare', disabled: true, note: 'bientôt' },
          { value: 'kamea', label: 'Kamea' },
        ]}
      />,
    );

    expect(screen.getByRole('group', { name: 'Méthode' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Kamea' })).toBeChecked();
    const spare = screen.getByRole('radio', { name: 'Spare bientôt' });
    // Browsers ignore clicks and arrow keys on a disabled radio (jsdom does not), so the attribute is what matters.
    expect(spare).toBeDisabled();
  });
});

describe('ChoiceCards', () => {
  it('reads label and detail as one name and reports the choice', () => {
    const onChange = vi.fn();
    render(
      <ChoiceCards
        legend="Carré"
        name="planet"
        value="saturn"
        onChange={onChange}
        options={[
          { value: 'saturn', label: 'Saturne', detail: '3×3' },
          { value: 'moon', label: 'Lune', detail: '9×9' },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Lune 9×9' }));

    expect(screen.getByRole('radio', { name: 'Saturne 3×3' })).toBeChecked();
    expect(onChange).toHaveBeenCalledWith('moon');
  });
});

describe('Disclosure', () => {
  it('shows its heading and reports a toggle', () => {
    const onOpenChange = vi.fn();
    const { container } = render(
      <Disclosure title="Comment c’est fait" open={false} onOpenChange={onOpenChange}>
        <p>Étapes</p>
      </Disclosure>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Comment c’est fait' })).toBeVisible();
    const details = container.querySelector('details');
    if (details === null) throw new Error('No <details> rendered.');
    details.open = true;
    fireEvent(details, new Event('toggle'));

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});

describe('StatusMessage', () => {
  it('announces its text politely', () => {
    render(<StatusMessage tone="warning">Caractères ignorés.</StatusMessage>);

    expect(screen.getByRole('status')).toHaveTextContent('Caractères ignorés.');
    expect(screen.getByRole('status')).toHaveClass('status-message--warning');
  });
});

describe('Switch', () => {
  it('is a labelled switch described by its help, and reports a toggle', () => {
    const onCheckedChange = vi.fn();
    render(
      <Switch
        id="keep-vowels"
        label="Garder les voyelles"
        checked={false}
        onCheckedChange={onCheckedChange}
        onText="oui"
        offText="non"
        help="Par défaut, les voyelles sont retirées."
      />,
    );

    const toggle = screen.getByRole('switch', { name: 'Garder les voyelles' });
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveAccessibleDescription('Par défaut, les voyelles sont retirées.');
    expect(screen.getByText('non')).toHaveAttribute('aria-hidden', 'true');

    fireEvent.click(toggle);

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('writes the state next to the switch', () => {
    render(
      <Switch
        id="keep-vowels"
        label="Garder les voyelles"
        checked
        onCheckedChange={vi.fn()}
        onText="oui"
        offText="non"
      />,
    );

    expect(screen.getByRole('switch')).toBeChecked();
    expect(screen.getByText('oui')).toBeInTheDocument();
  });
});

describe('Slider', () => {
  it('is a labelled range with its bounds, spoken value and help, and reports a move', () => {
    const onValueChange = vi.fn();
    render(
      <Slider
        id="stroke-width"
        label="Épaisseur"
        value={1.2}
        min={0.4}
        max={4}
        step={0.2}
        valueText="fin · 1,2"
        ariaValueText="1,2, fin"
        help="De 0,4 à 4."
        onValueChange={onValueChange}
      />,
    );

    const slider = screen.getByRole('slider', { name: 'Épaisseur' });
    expect(slider).toHaveAttribute('min', '0.4');
    expect(slider).toHaveAttribute('max', '4');
    expect(slider).toHaveAttribute('step', '0.2');
    expect(slider).toHaveValue('1.2');
    expect(slider).toHaveAttribute('aria-valuetext', '1,2, fin');
    expect(slider).toHaveAccessibleDescription('De 0,4 à 4.');
    expect(screen.getByText('fin · 1,2')).toHaveAttribute('aria-hidden', 'true');

    fireEvent.change(slider, { target: { value: '2' } });

    expect(onValueChange).toHaveBeenCalledWith(2);
  });

  it('reads the visible value when no spoken value is given', () => {
    render(
      <Slider
        id="size"
        label="Taille"
        value={3}
        min={1}
        max={5}
        step={1}
        valueText="3"
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('slider', { name: 'Taille' })).toHaveAttribute('aria-valuetext', '3');
  });
});

describe('CompactChoice', () => {
  it('names each segment by its label, not its face, and reports the choice', () => {
    const onChange = vi.fn();
    render(
      <CompactChoice
        legend="Langue de l’interface"
        name="language"
        options={[
          { value: 'fr', face: 'FR', label: 'Français', lang: 'fr' },
          { value: 'en', face: 'EN', label: 'English', lang: 'en' },
        ]}
        value="fr"
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('group', { name: 'Langue de l’interface' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Français' })).toBeChecked();
    const english = screen.getByRole('radio', { name: 'English' });
    expect(english.closest('label')).toHaveAttribute('lang', 'en');
    expect(english.closest('label')).toHaveAttribute('title', 'English');
    expect(screen.getByText('EN')).toHaveAttribute('aria-hidden', 'true');

    fireEvent.click(english);

    expect(onChange).toHaveBeenCalledWith('en');
  });
});
