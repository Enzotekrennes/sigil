/**
 * Component tests of the generic interface components, through their
 * visible behaviour and accessibility: roles, names, descriptions, states.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button.tsx';
import { ChoiceCards } from './ChoiceCards.tsx';
import { Disclosure } from './Disclosure.tsx';
import { SegmentedControl } from './SegmentedControl.tsx';
import { StatusMessage } from './StatusMessage.tsx';
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
